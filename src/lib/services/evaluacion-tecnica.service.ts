import crypto from 'crypto';
import { pool } from '@/lib/db';
import { getAppUrl } from '@/lib/utils/url';
import { seleccionarPreguntas } from './banco-preguntas.service';
import { calcularScoreEvaluacion } from './evaluacion-scoring.service';
import type {
  Evaluacion,
  EstructuraPlantilla,
  PreguntaAsignada,
  RespuestaCandidato,
} from '@/lib/types/evaluacion-tecnica.types';
import { NotFoundError } from '@/lib/utils/errors';

/**
 * Orquestador de evaluaciones técnicas.
 *
 * Flujo:
 * 1. Reclutador selecciona plantilla o arma evaluación ad-hoc
 * 2. Sistema selecciona preguntas del banco (aleatorias según estructura)
 * 3. Se genera token único y se crea registro de evaluación
 * 4. Se envía notificación al candidato con link: /evaluacion/{token}
 * 5. Candidato responde (portal público, sin login)
 * 6. Al completar: scoring automático + actualizar score en aplicación
 */

export async function crearEvaluacion(data: {
  organization_id: string;
  aplicacion_id: string;
  candidato_id: string;
  vacante_id: string;
  plantilla_id?: string | null;
  titulo: string;
  duracion_minutos: number;
  puntaje_aprobatorio: number;
  preguntas?: PreguntaAsignada[];
  estructura?: EstructuraPlantilla[];
  asignado_por: string;
}): Promise<Evaluacion> {
  const token = crypto.randomBytes(32).toString('hex');

  // Select questions from banco if estructura provided
  let preguntas: PreguntaAsignada[];
  if (data.preguntas && data.preguntas.length > 0) {
    preguntas = data.preguntas;
  } else if (data.estructura && data.estructura.length > 0) {
    preguntas = await seleccionarPreguntas(data.organization_id, data.estructura);
  } else {
    throw new Error('Se requieren preguntas o estructura para crear la evaluación');
  }

  const puntajeTotal = preguntas.reduce((sum, p) => sum + p.puntos, 0);

  const result = await pool.query(
    `INSERT INTO evaluaciones (
      organization_id, aplicacion_id, candidato_id, vacante_id,
      plantilla_id, titulo, duracion_minutos, puntaje_total,
      puntaje_aprobatorio, preguntas, estado, token_acceso, asignado_por
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *`,
    [
      data.organization_id, data.aplicacion_id, data.candidato_id, data.vacante_id,
      data.plantilla_id || null, data.titulo, data.duracion_minutos, puntajeTotal,
      data.puntaje_aprobatorio, JSON.stringify(preguntas), 'pendiente', token,
      data.asignado_por,
    ]
  );

  return result.rows[0];
}

export async function enviarEvaluacion(evaluacionId: string, orgId: string): Promise<{ url: string }> {
  const result = await pool.query(
    `SELECT e.*, c.nombre as candidato_nombre, c.email as candidato_email, v.titulo as vacante_titulo
     FROM evaluaciones e
     JOIN candidatos c ON c.id = e.candidato_id
     JOIN vacantes v ON v.id = e.vacante_id
     WHERE e.id = $1 AND e.organization_id = $2`,
    [evaluacionId, orgId]
  );

  if (result.rows.length === 0) throw new NotFoundError('Evaluación', evaluacionId);
  const ev = result.rows[0];

  if (ev.estado !== 'pendiente' && ev.estado !== 'enviada') {
    throw new Error(`No se puede enviar una evaluación en estado: ${ev.estado}`);
  }

  const baseUrl = getAppUrl();
  const url = `${baseUrl}/evaluacion/${ev.token_acceso}`;
  const expiraAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

  await pool.query(
    `UPDATE evaluaciones SET
       estado = 'enviada',
       enviada_at = NOW(),
       token_expira_at = $1,
       updated_at = NOW()
     WHERE id = $2`,
    [expiraAt.toISOString(), evaluacionId]
  );

  // Send evaluation email to candidate
  const { enviarEmail } = await import('./email.service');
  await enviarEmail({
    to: ev.candidato_email,
    subject: `Evaluacion Tecnica — ${ev.vacante_titulo}`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0A1F3F; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Hirely</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #0A1F3F; margin-top: 0;">Hola, ${ev.candidato_nombre}!</h2>
          <p style="color: #374151; line-height: 1.6;">
            Te hemos asignado una evaluacion tecnica para la posicion de <strong>${ev.vacante_titulo}</strong>.
          </p>
          <p style="color: #374151; line-height: 1.6;">
            Tienes <strong>72 horas</strong> para completarla.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" style="background: #00BCD4; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Iniciar Evaluacion
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Este enlace expira el ${expiraAt.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>
        </div>
      </div>
    `,
    tags: { type: 'evaluacion_tecnica', evaluacion_id: evaluacionId },
  });

  await pool.query(
    `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
     VALUES ($1, 'evaluacion', $2, 'enviada', $3)`,
    [orgId, evaluacionId, JSON.stringify({
      candidato: ev.candidato_nombre,
      email: ev.candidato_email,
      vacante: ev.vacante_titulo,
      url,
    })]
  );

  return { url };
}

export async function obtenerEvaluacionPorToken(token: string): Promise<{
  evaluacion: Evaluacion;
  candidato_nombre: string;
  vacante_titulo: string;
  empresa_nombre: string;
  tiempo_restante_segundos: number | null;
} | null> {
  const result = await pool.query(
    `SELECT e.*,
            c.nombre as candidato_nombre,
            v.titulo as vacante_titulo,
            o.name as empresa_nombre
     FROM evaluaciones e
     JOIN candidatos c ON c.id = e.candidato_id
     JOIN vacantes v ON v.id = e.vacante_id
     JOIN organizations o ON o.id = e.organization_id
     WHERE e.token_acceso = $1`,
    [token]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];

  // Check expiration
  if (row.token_expira_at && new Date(row.token_expira_at) < new Date()) {
    if (row.estado === 'enviada' || row.estado === 'en_progreso') {
      await pool.query(
        `UPDATE evaluaciones SET estado = 'expirada', updated_at = NOW() WHERE id = $1`,
        [row.id]
      );
      row.estado = 'expirada';
    }
  }

  // Calculate remaining time
  let tiempo_restante_segundos: number | null = null;
  if (row.iniciada_at && row.estado === 'en_progreso') {
    const iniciadaAt = new Date(row.iniciada_at).getTime();
    const duracionMs = row.duracion_minutos * 60 * 1000;
    const restante = Math.max(0, (iniciadaAt + duracionMs - Date.now()) / 1000);
    tiempo_restante_segundos = Math.floor(restante);
  }

  // Strip correct answers from questions for candidate view
  const preguntas = (typeof row.preguntas === 'string' ? JSON.parse(row.preguntas) : row.preguntas)
    .map((p: PreguntaAsignada) => ({
      ...p,
      opciones: p.opciones?.map(o => ({ id: o.id, texto: o.texto })) || null,
    }));

  return {
    evaluacion: { ...row, preguntas },
    candidato_nombre: row.candidato_nombre,
    vacante_titulo: row.vacante_titulo,
    empresa_nombre: row.empresa_nombre,
    tiempo_restante_segundos,
  };
}

export async function iniciarEvaluacion(token: string): Promise<void> {
  const result = await pool.query(
    `UPDATE evaluaciones SET
       estado = 'en_progreso',
       iniciada_at = NOW(),
       updated_at = NOW()
     WHERE token_acceso = $1 AND estado = 'enviada'
     RETURNING id`,
    [token]
  );
  if (result.rows.length === 0) {
    throw new Error('No se puede iniciar la evaluación. Estado inválido o token incorrecto.');
  }
}

export async function guardarRespuestas(
  token: string,
  respuestas: RespuestaCandidato[]
): Promise<{ score: number; aprobada: boolean; detalle: Record<string, unknown>; mostrar_resultados: boolean }> {
  // Get evaluation with correct answers
  const evResult = await pool.query(
    `SELECT e.*, ep.mostrar_resultados_al_candidato
     FROM evaluaciones e
     LEFT JOIN evaluacion_plantillas ep ON ep.id = e.plantilla_id
     WHERE e.token_acceso = $1 AND e.estado IN ('en_progreso', 'enviada')`,
    [token]
  );

  if (evResult.rows.length === 0) {
    throw new Error('Evaluación no encontrada o ya completada');
  }

  const ev = evResult.rows[0];
  const preguntasSnapshot = typeof ev.preguntas === 'string' ? JSON.parse(ev.preguntas) : ev.preguntas;

  // Get original questions from banco for correct answers
  const preguntaIds = preguntasSnapshot.map((p: PreguntaAsignada) => p.pregunta_id);
  const { obtenerPreguntasConRespuestas } = await import('./banco-preguntas.service');
  const preguntasOriginales = await obtenerPreguntasConRespuestas(preguntaIds);

  // Build full questions with correct answers for scoring
  const preguntasConRespuesta = preguntasSnapshot.map((p: PreguntaAsignada) => {
    const original = preguntasOriginales.get(p.pregunta_id);
    return {
      ...p,
      opciones: original?.opciones || p.opciones,
      respuesta_correcta: original?.respuesta_correcta || null,
      explicacion: original?.explicacion || null,
    };
  });

  // Calculate score
  const resultado = await calcularScoreEvaluacion(
    preguntasConRespuesta,
    respuestas,
    ev.puntaje_aprobatorio
  );

  // Save results
  await pool.query(
    `UPDATE evaluaciones SET
       estado = 'completada',
       respuestas = $1,
       score_total = $2,
       score_detalle = $3,
       aprobada = $4,
       completada_at = NOW(),
       updated_at = NOW()
     WHERE id = $5`,
    [
      JSON.stringify(respuestas),
      resultado.score_total,
      JSON.stringify(resultado.detalle),
      resultado.aprobada,
      ev.id,
    ]
  );

  // Update application score_tecnico
  await pool.query(
    `UPDATE aplicaciones SET
       score_tecnico = $1,
       evaluacion_tecnica_id = $2,
       updated_at = NOW()
     WHERE id = $3`,
    [resultado.score_total, ev.id, ev.aplicacion_id]
  );

  // Recalculate score_final with all available components
  try {
    const { recalcularScoreFinal } = await import('./scoring-dual.service');
    await recalcularScoreFinal(ev.aplicacion_id);
  } catch (err) {
    console.error('[Evaluacion Tecnica] Error recalculando score_final:', err);
  }

  // Update pipeline estado to 'evaluado'
  await pool.query(
    `UPDATE aplicaciones SET
       estado = 'evaluado',
       updated_at = NOW()
     WHERE id = $1 AND estado IN ('nuevo','en_revision','preseleccionado','entrevista_ia','entrevista_humana')`,
    [ev.aplicacion_id]
  );

  // Activity log
  await pool.query(
    `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
     VALUES ($1, 'evaluacion', $2, 'completada', $3)`,
    [ev.organization_id, ev.id, JSON.stringify({
      score: resultado.score_total,
      aprobada: resultado.aprobada,
    })]
  );

  // Notify admin(s) about completed technical evaluation
  try {
    const adminResult = await pool.query(
      `SELECT email FROM users WHERE organization_id = $1 AND role IN ('admin') AND is_active = true`,
      [ev.organization_id]
    );
    const adminEmails = adminResult.rows.map((r: { email: string }) => r.email);

    if (adminEmails.length > 0) {
      const { enviarEmail } = await import('./email.service');
      const { emailNotificacionEvaluacion } = await import('@/lib/utils/email-templates');

      // Get candidate and vacancy info for the notification
      const infoResult = await pool.query(
        `SELECT c.nombre as candidato_nombre, v.titulo as vacante_titulo
         FROM evaluaciones e
         JOIN candidatos c ON c.id = e.candidato_id
         JOIN vacantes v ON v.id = e.vacante_id
         WHERE e.id = $1`,
        [ev.id]
      );
      const info = infoResult.rows[0];

      if (info) {
        const baseUrl = getAppUrl();
        const dashboardUrl = `${baseUrl}/evaluaciones`;

        const { subject, htmlBody } = emailNotificacionEvaluacion({
          candidatoNombre: info.candidato_nombre,
          vacanteTitulo: info.vacante_titulo,
          scoreTecnico: resultado.score_total,
          puntajeAprobatorio: ev.puntaje_aprobatorio,
          aprobada: resultado.aprobada,
          dashboardUrl,
        });

        await enviarEmail({
          to: adminEmails,
          subject,
          html: htmlBody,
          tags: { type: 'notificacion_evaluacion', evaluacion_id: ev.id },
        });
      }
    }
  } catch (emailError) {
    console.error(`[Evaluacion Tecnica] Error enviando notificación email para evaluación ${ev.id}:`, emailError);
  }

  return {
    score: resultado.score_total,
    aprobada: resultado.aprobada,
    detalle: resultado.detalle,
    mostrar_resultados: ev.mostrar_resultados_al_candidato || false,
  };
}

// ─── CRUD for dashboard ───

export async function listarEvaluaciones(orgId: string, filters?: {
  vacante_id?: string;
  estado?: string;
}): Promise<Evaluacion[]> {
  const conditions = ['e.organization_id = $1'];
  const params: unknown[] = [orgId];
  let idx = 2;

  if (filters?.vacante_id) {
    conditions.push(`e.vacante_id = $${idx++}`);
    params.push(filters.vacante_id);
  }
  if (filters?.estado) {
    conditions.push(`e.estado = $${idx++}`);
    params.push(filters.estado);
  }

  const result = await pool.query(
    `SELECT e.*,
            c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
            v.titulo as vacante_titulo
     FROM evaluaciones e
     JOIN candidatos c ON c.id = e.candidato_id
     JOIN vacantes v ON v.id = e.vacante_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.created_at DESC`,
    params
  );

  return result.rows;
}

export async function obtenerEvaluacion(id: string, orgId: string): Promise<Evaluacion> {
  const result = await pool.query(
    `SELECT e.*,
            c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
            v.titulo as vacante_titulo
     FROM evaluaciones e
     JOIN candidatos c ON c.id = e.candidato_id
     JOIN vacantes v ON v.id = e.vacante_id
     WHERE e.id = $1 AND e.organization_id = $2`,
    [id, orgId]
  );

  if (result.rows.length === 0) throw new NotFoundError('Evaluación', id);
  return result.rows[0];
}

export async function cancelarEvaluacion(id: string, orgId: string): Promise<void> {
  const result = await pool.query(
    `UPDATE evaluaciones SET estado = 'cancelada', updated_at = NOW()
     WHERE id = $1 AND organization_id = $2 AND estado IN ('pendiente', 'enviada')
     RETURNING id`,
    [id, orgId]
  );
  if (result.rows.length === 0) throw new Error('No se puede cancelar la evaluación');
}

// ─── Plantillas CRUD ───

export async function listarPlantillas(orgId: string): Promise<import('@/lib/types/evaluacion-tecnica.types').EvaluacionPlantilla[]> {
  const result = await pool.query(
    `SELECT * FROM evaluacion_plantillas
     WHERE organization_id = $1 AND estado != 'archivada'
     ORDER BY created_at DESC`,
    [orgId]
  );
  return result.rows;
}

export async function crearPlantilla(
  orgId: string,
  data: Partial<import('@/lib/types/evaluacion-tecnica.types').EvaluacionPlantilla>,
  creadoPor: string
): Promise<import('@/lib/types/evaluacion-tecnica.types').EvaluacionPlantilla> {
  const result = await pool.query(
    `INSERT INTO evaluacion_plantillas (
      organization_id, nombre, descripcion, duracion_minutos,
      puntaje_total, puntaje_aprobatorio, aleatorizar_preguntas,
      mostrar_resultados_al_candidato, estructura, cargos_sugeridos,
      tags, estado, creado_por
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *`,
    [
      orgId, data.nombre, data.descripcion || null, data.duracion_minutos || 60,
      data.puntaje_total || 100, data.puntaje_aprobatorio || 70,
      data.aleatorizar_preguntas ?? true, data.mostrar_resultados_al_candidato ?? false,
      JSON.stringify(data.estructura || []), data.cargos_sugeridos || [],
      data.tags || [], data.estado || 'activa', creadoPor,
    ]
  );
  return result.rows[0];
}

export async function obtenerPlantilla(id: string, orgId: string): Promise<import('@/lib/types/evaluacion-tecnica.types').EvaluacionPlantilla> {
  const result = await pool.query(
    'SELECT * FROM evaluacion_plantillas WHERE id = $1 AND organization_id = $2',
    [id, orgId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Plantilla', id);
  return result.rows[0];
}

export async function actualizarPlantilla(
  id: string,
  orgId: string,
  data: Partial<import('@/lib/types/evaluacion-tecnica.types').EvaluacionPlantilla>
): Promise<import('@/lib/types/evaluacion-tecnica.types').EvaluacionPlantilla> {
  const fields: string[] = [];
  const params: unknown[] = [id, orgId];
  let idx = 3;

  const map: Record<string, (v: unknown) => unknown> = {
    nombre: v => v, descripcion: v => v, duracion_minutos: v => v,
    puntaje_total: v => v, puntaje_aprobatorio: v => v,
    aleatorizar_preguntas: v => v, mostrar_resultados_al_candidato: v => v,
    estructura: v => JSON.stringify(v), cargos_sugeridos: v => v,
    tags: v => v, estado: v => v,
  };

  for (const [key, transform] of Object.entries(map)) {
    if ((data as Record<string, unknown>)[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      params.push(transform((data as Record<string, unknown>)[key]));
    }
  }

  if (fields.length === 0) return obtenerPlantilla(id, orgId);
  fields.push('updated_at = NOW()');

  const result = await pool.query(
    `UPDATE evaluacion_plantillas SET ${fields.join(', ')} WHERE id = $1 AND organization_id = $2 RETURNING *`,
    params
  );
  if (result.rows.length === 0) throw new NotFoundError('Plantilla', id);
  return result.rows[0];
}
