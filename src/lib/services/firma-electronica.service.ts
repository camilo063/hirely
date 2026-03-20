/**
 * Firma Electronica Service — orchestrates contract signing via swappable providers.
 *
 * Provider selected by FIRMA_PROVIDER env var (signwell | docusign | mock).
 * All errors are non-blocking: if signing fails, the contract stays in its current state.
 */

import { pool } from '../db';
import { UUID } from '../types/common.types';
import { NotFoundError } from '../utils/errors';
import { getAppUrl } from '../utils/url';
import { crearFirmaProvider } from '../integrations/firma';
import type { Signatario } from '../integrations/firma';

const firmaProvider = crearFirmaProvider();

export async function enviarParaFirma(
  orgId: UUID,
  contratoId: UUID
): Promise<{ success: boolean; signingUrl?: string; error?: string }> {
  try {
    // Get contrato with relations
    const result = await pool.query(
      `SELECT ct.*, c.email as candidato_email, c.nombre as candidato_nombre,
              c.apellido as candidato_apellido,
              v.titulo as vacante_titulo,
              o.name as org_nombre
       FROM contratos ct
       JOIN candidatos c ON ct.candidato_id = c.id
       JOIN vacantes v ON ct.vacante_id = v.id
       JOIN organizations o ON o.id = ct.organization_id
       WHERE ct.id = $1 AND ct.organization_id = $2`,
      [contratoId, orgId]
    );

    if (result.rows.length === 0) throw new NotFoundError('Contrato', contratoId);
    const contrato = result.rows[0];

    if (contrato.estado !== 'generado') {
      return { success: false, error: `Solo se puede enviar para firma un contrato en estado "generado". Estado actual: ${contrato.estado}` };
    }

    if (!contrato.contenido_html) {
      return { success: false, error: 'El contrato no tiene contenido HTML generado' };
    }

    const candidatoNombre = `${contrato.candidato_nombre} ${contrato.candidato_apellido || ''}`.trim();
    const appUrl = getAppUrl();

    const signatarios: Signatario[] = [
      {
        nombre: candidatoNombre,
        email: contrato.candidato_email,
        orden: 1,
        rol: 'candidato',
      },
    ];

    // Get org admin as company signer — check configurable email first
    const orgSettingsResult = await pool.query(
      `SELECT email_firma_admin FROM org_settings WHERE organization_id = $1`,
      [orgId]
    );
    const configuredEmail = orgSettingsResult.rows[0]?.email_firma_admin;

    if (configuredEmail) {
      // Use configured firma admin email
      const adminResult = await pool.query(
        `SELECT name FROM users WHERE organization_id = $1 AND email = $2 AND is_active = true LIMIT 1`,
        [orgId, configuredEmail]
      );
      signatarios.push({
        nombre: adminResult.rows[0]?.name || contrato.org_nombre,
        email: configuredEmail,
        orden: 2,
        rol: 'empresa',
      });
    } else {
      // Fallback to first active admin
      const adminResult = await pool.query(
        `SELECT name, email FROM users WHERE organization_id = $1 AND role = 'admin' AND is_active = true LIMIT 1`,
        [orgId]
      );
      if (adminResult.rows.length > 0) {
        signatarios.push({
          nombre: adminResult.rows[0].name,
          email: adminResult.rows[0].email,
          orden: 2,
          rol: 'empresa',
        });
      }
    }

    const firmaResult = await firmaProvider.enviarParaFirma({
      contratoId,
      titulo: `Contrato — ${candidatoNombre} — ${contrato.vacante_titulo}`,
      htmlContenido: contrato.contenido_html,
      signatarios,
      webhookUrl: `${appUrl}/api/webhooks/firma`,
      expiresInDays: 30,
      mensaje: `Estimado/a ${candidatoNombre}, por favor revisa y firma tu contrato para la posicion de ${contrato.vacante_titulo} en ${contrato.org_nombre}.`,
    });

    // Update contrato in DB
    const providerName = process.env.FIRMA_PROVIDER ?? 'mock';
    await pool.query(
      `UPDATE contratos SET
        estado = 'enviado',
        firma_provider = $3,
        firma_external_id = $4,
        firma_url = $5,
        updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [contratoId, orgId, providerName, firmaResult.externalId, firmaResult.signingUrl ?? null]
    );

    // Activity log
    await pool.query(
      `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
       VALUES ($1, 'contrato', $2, 'enviado_para_firma', $3)`,
      [orgId, contratoId, JSON.stringify({
        provider: providerName,
        external_id: firmaResult.externalId,
        signatarios: signatarios.map(s => s.email),
      })]
    );

    return { success: true, signingUrl: firmaResult.signingUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error enviando para firma';
    console.error('[Firma] Error:', message);
    return { success: false, error: message };
  }
}

export async function sincronizarEstadoFirma(
  contratoId: UUID,
  orgId: UUID
): Promise<{ status: string; completado: boolean; signatarios?: { email: string; nombre: string; firmado: boolean; firmado_at?: string }[] }> {
  const result = await pool.query(
    'SELECT firma_external_id, estado FROM contratos WHERE id = $1 AND organization_id = $2',
    [contratoId, orgId]
  );

  if (result.rows.length === 0) throw new NotFoundError('Contrato', contratoId);
  const { firma_external_id } = result.rows[0];

  if (!firma_external_id) {
    return { status: result.rows[0].estado, completado: result.rows[0].estado === 'firmado' };
  }

  try {
    const estado = await firmaProvider.obtenerEstado(firma_external_id);

    // Update DB if status changed
    if (estado.status === 'completed' && result.rows[0].estado !== 'firmado') {
      await pool.query(
        `UPDATE contratos SET estado = 'firmado', firmado_at = $2, updated_at = NOW()
         WHERE id = $1`,
        [contratoId, estado.completado_at ?? new Date().toISOString()]
      );
    } else if (estado.status === 'declined' && result.rows[0].estado !== 'rechazado') {
      await pool.query(
        `UPDATE contratos SET estado = 'rechazado', updated_at = NOW() WHERE id = $1`,
        [contratoId]
      );
    }

    return {
      status: estado.status,
      completado: estado.status === 'completed',
      signatarios: estado.signatarios,
    };
  } catch (err) {
    console.error('[Firma] Error sincronizando estado:', err);
    return { status: result.rows[0].estado, completado: false };
  }
}

export async function descargarDocumentoFirmado(
  contratoId: UUID,
  orgId: UUID
): Promise<{ success: boolean; url?: string; buffer?: Buffer; error?: string }> {
  const result = await pool.query(
    'SELECT firma_external_id, firma_pdf_url, estado FROM contratos WHERE id = $1 AND organization_id = $2',
    [contratoId, orgId]
  );

  if (result.rows.length === 0) throw new NotFoundError('Contrato', contratoId);
  const contrato = result.rows[0];

  if (contrato.estado !== 'firmado') {
    return { success: false, error: 'El contrato no esta firmado' };
  }

  // Return cached URL if available
  if (contrato.firma_pdf_url) {
    return { success: true, url: contrato.firma_pdf_url };
  }

  if (!contrato.firma_external_id) {
    return { success: false, error: 'No hay firma externa asociada' };
  }

  try {
    const pdfBuffer = await firmaProvider.descargarDocumentoFirmado(contrato.firma_external_id);

    // Save to local storage
    const fs = await import('fs/promises');
    const path = await import('path');
    const dir = path.join(process.cwd(), 'public', 'uploads', 'contratos');
    await fs.mkdir(dir, { recursive: true });

    const filename = `contrato_firmado_${contratoId}.pdf`;
    await fs.writeFile(path.join(dir, filename), pdfBuffer);

    const url = `/uploads/contratos/${filename}`;
    await pool.query(
      'UPDATE contratos SET firma_pdf_url = $2, updated_at = NOW() WHERE id = $1',
      [contratoId, url]
    );

    return { success: true, url, buffer: pdfBuffer };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error descargando PDF firmado';
    console.error('[Firma] Error descargando:', message);
    return { success: false, error: message };
  }
}

// Legacy compat
export async function checkFirmaStatus(
  orgId: UUID,
  contratoId: UUID
): Promise<{ estado: string; firmado_at: Date | null }> {
  const result = await pool.query(
    'SELECT estado, firmado_at FROM contratos WHERE id = $1 AND organization_id = $2',
    [contratoId, orgId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Contrato', contratoId);
  return { estado: result.rows[0].estado, firmado_at: result.rows[0].firmado_at };
}
