/**
 * Calendar service — orchestrates Google Calendar integration for interviews.
 *
 * Non-blocking: if Calendar fails, the interview still gets created.
 * Token management: refreshes expired tokens automatically.
 */

import { pool } from '@/lib/db';
import {
  crearEventoCalendar,
  actualizarEventoCalendar,
  cancelarEventoCalendar,
  refrescarToken,
} from '@/lib/integrations/google-calendar.client';

interface GoogleToken {
  id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  google_account_email: string | null;
}

async function obtenerTokenActivo(userId: string, organizationId: string): Promise<GoogleToken | null> {
  const result = await pool.query<GoogleToken>(
    `SELECT id, access_token, refresh_token, expires_at, google_account_email
     FROM google_tokens
     WHERE user_id = $1 AND organization_id = $2 AND is_active = true`,
    [userId, organizationId]
  );

  if (result.rows.length === 0) return null;
  const token = result.rows[0];

  // Refresh if expired
  if (token.expires_at && new Date(token.expires_at) < new Date() && token.refresh_token) {
    try {
      const refreshed = await refrescarToken(token.refresh_token);
      await pool.query(
        `UPDATE google_tokens SET access_token = $1, expires_at = $2, last_used_at = NOW(), updated_at = NOW()
         WHERE id = $3`,
        [refreshed.accessToken, refreshed.expiresAt.toISOString(), token.id]
      );
      token.access_token = refreshed.accessToken;
    } catch (err) {
      console.error('[Calendar] Error refreshing token:', err);
      return null;
    }
  }

  // Mark as used
  await pool.query(`UPDATE google_tokens SET last_used_at = NOW() WHERE id = $1`, [token.id]);
  return token;
}

export async function crearEventoParaEntrevista(
  entrevistaId: string,
  userId: string
): Promise<{ success: boolean; meetLink?: string; calendarLink?: string; error?: string }> {
  try {
    // Get interview with relations
    const entResult = await pool.query(
      `SELECT eh.*,
              c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
              v.titulo as vacante_titulo, v.organization_id,
              u.name as entrevistador_nombre, u.email as entrevistador_email
       FROM entrevistas_humanas eh
       JOIN candidatos c ON eh.candidato_id = c.id
       JOIN vacantes v ON eh.vacante_id = v.id
       JOIN users u ON eh.entrevistador_id = u.id
       WHERE eh.id = $1`,
      [entrevistaId]
    );

    if (entResult.rows.length === 0) {
      return { success: false, error: 'Entrevista no encontrada' };
    }

    const ent = entResult.rows[0];
    const token = await obtenerTokenActivo(userId, ent.organization_id);

    if (!token) {
      return { success: false, error: 'Google Calendar no conectado' };
    }

    const fechaInicio = new Date(ent.fecha_programada);
    const duracion = ent.duracion_minutos || 60;
    const fechaFin = new Date(fechaInicio.getTime() + duracion * 60 * 1000);

    const candidatoNombre = `${ent.candidato_nombre} ${ent.candidato_apellido || ''}`.trim();

    const invitados: string[] = [];
    if (ent.candidato_email) invitados.push(ent.candidato_email);
    if (ent.entrevistador_email) invitados.push(ent.entrevistador_email);

    const evento = await crearEventoCalendar({
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? undefined,
      titulo: `Entrevista: ${candidatoNombre} — ${ent.vacante_titulo}`,
      descripcion: `Entrevista para la posicion de ${ent.vacante_titulo}.\nCandidato: ${candidatoNombre}\nEntrevistador: ${ent.entrevistador_nombre}`,
      fechaInicio,
      fechaFin,
      invitados,
      generarMeet: true,
    });

    // Save calendar event
    await pool.query(
      `INSERT INTO calendar_events (organization_id, entrevista_id, google_event_id, html_link, hangout_link, status)
       VALUES ($1, $2, $3, $4, $5, 'confirmed')
       ON CONFLICT (entrevista_id) DO UPDATE SET
         google_event_id = $3, html_link = $4, hangout_link = $5, status = 'confirmed', updated_at = NOW()`,
      [ent.organization_id, entrevistaId, evento.eventId, evento.htmlLink, evento.hangoutLink ?? null]
    );

    // Update entrevista with meet_link
    if (evento.hangoutLink) {
      await pool.query(
        `UPDATE entrevistas_humanas SET meet_link = $1, updated_at = NOW() WHERE id = $2`,
        [evento.hangoutLink, entrevistaId]
      );
    }

    return {
      success: true,
      meetLink: evento.hangoutLink,
      calendarLink: evento.htmlLink,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error creando evento de calendar';
    console.error('[Calendar] Error:', message);
    return { success: false, error: message };
  }
}

export async function actualizarEventoEntrevista(
  entrevistaId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ceResult = await pool.query(
      `SELECT ce.google_event_id, eh.organization_id, eh.fecha_programada, eh.duracion_minutos,
              c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
              v.titulo as vacante_titulo, u.email as entrevistador_email
       FROM calendar_events ce
       JOIN entrevistas_humanas eh ON eh.id = ce.entrevista_id
       JOIN candidatos c ON eh.candidato_id = c.id
       JOIN vacantes v ON eh.vacante_id = v.id
       JOIN users u ON eh.entrevistador_id = u.id
       WHERE ce.entrevista_id = $1`,
      [entrevistaId]
    );

    if (ceResult.rows.length === 0) {
      return { success: false, error: 'No hay evento de calendar para esta entrevista' };
    }

    const data = ceResult.rows[0];
    const token = await obtenerTokenActivo(userId, data.organization_id);
    if (!token) return { success: false, error: 'Google Calendar no conectado' };

    const fechaInicio = new Date(data.fecha_programada);
    const fechaFin = new Date(fechaInicio.getTime() + (data.duracion_minutos || 60) * 60 * 1000);
    const candidatoNombre = `${data.candidato_nombre} ${data.candidato_apellido || ''}`.trim();

    const invitados: string[] = [];
    if (data.candidato_email) invitados.push(data.candidato_email);
    if (data.entrevistador_email) invitados.push(data.entrevistador_email);

    await actualizarEventoCalendar({
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? undefined,
      eventId: data.google_event_id,
      titulo: `Entrevista: ${candidatoNombre} — ${data.vacante_titulo}`,
      fechaInicio,
      fechaFin,
      invitados,
    });

    await pool.query(
      `UPDATE calendar_events SET last_synced_at = NOW(), updated_at = NOW() WHERE entrevista_id = $1`,
      [entrevistaId]
    );

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error actualizando evento';
    console.error('[Calendar] Error:', message);
    return { success: false, error: message };
  }
}

export async function cancelarEventoEntrevista(
  entrevistaId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ceResult = await pool.query(
      `SELECT ce.google_event_id, eh.organization_id
       FROM calendar_events ce
       JOIN entrevistas_humanas eh ON eh.id = ce.entrevista_id
       WHERE ce.entrevista_id = $1`,
      [entrevistaId]
    );

    if (ceResult.rows.length === 0) return { success: true };

    const data = ceResult.rows[0];
    const token = await obtenerTokenActivo(userId, data.organization_id);
    if (!token) return { success: false, error: 'Google Calendar no conectado' };

    await cancelarEventoCalendar({
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? undefined,
      eventId: data.google_event_id,
    });

    await pool.query(
      `UPDATE calendar_events SET status = 'cancelled', updated_at = NOW() WHERE entrevista_id = $1`,
      [entrevistaId]
    );

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error cancelando evento';
    console.error('[Calendar] Error:', message);
    return { success: false, error: message };
  }
}

export async function getCalendarStatus(
  userId: string,
  orgId: string
): Promise<{ conectado: boolean; email?: string; scopes?: string[] }> {
  const result = await pool.query(
    `SELECT google_account_email, scopes FROM google_tokens
     WHERE user_id = $1 AND organization_id = $2 AND is_active = true`,
    [userId, orgId]
  );

  if (result.rows.length === 0) return { conectado: false };

  return {
    conectado: true,
    email: result.rows[0].google_account_email ?? undefined,
    scopes: result.rows[0].scopes ?? [],
  };
}
