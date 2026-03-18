import { pool } from '@/lib/db';
import { createDaptaClient } from '@/lib/integrations/dapta.client';
import { analizarTranscripcion, calcularScoreEntrevistaIA } from './entrevista-analisis.service';
import type { EntrevistaIA, DaptaWebhookPayload, PreguntasEntrevistaConfig, EntrevistaIAConDetalles } from '@/lib/types/entrevista.types';
import { PREGUNTAS_DEFAULT } from '@/lib/types/entrevista.types';
import { UUID } from '@/lib/types/common.types';
import { NotFoundError } from '@/lib/utils/errors';

/**
 * Servicio para gestionar entrevistas IA con Dapta.
 *
 * Flow:
 * 1. iniciarEntrevistaIA() → Creates record + triggers Dapta call
 * 2. Dapta calls candidate, conducts interview
 * 3. procesarResultadoLlamada() → Receives webhook, analyzes, saves scores
 */

export async function iniciarEntrevistaIA(
  aplicacionId: string,
  orgId: string,
  options?: {
    preguntasCustom?: string[];
    maxDuracion?: number;
    contextoAdicional?: string;
  }
): Promise<{ entrevistaId: string; status: 'initiated' | 'dapta_not_configured' | 'error'; error?: string }> {

  // 1. Get candidate and vacancy data
  const appResult = await pool.query(
    `SELECT a.id, a.vacante_id, a.candidato_id,
            c.nombre as candidato_nombre, c.telefono as candidato_telefono, c.email as candidato_email,
            v.titulo as vacante_titulo, v.habilidades_requeridas, v.criterios_evaluacion,
            o.name as empresa_nombre
     FROM aplicaciones a
     JOIN candidatos c ON c.id = a.candidato_id
     JOIN vacantes v ON v.id = a.vacante_id
     JOIN organizations o ON o.id = v.organization_id
     WHERE a.id = $1 AND v.organization_id = $2`,
    [aplicacionId, orgId]
  );

  if (appResult.rows.length === 0) throw new Error('Aplicación no encontrada');
  const app = appResult.rows[0];

  if (!app.candidato_telefono) {
    throw new Error('El candidato no tiene número de teléfono registrado. No se puede iniciar la entrevista IA.');
  }

  // 2. Check for existing active interview
  const existingResult = await pool.query(
    `SELECT id, estado FROM entrevistas_ia
     WHERE aplicacion_id = $1 AND estado NOT IN ('fallida', 'cancelada')`,
    [aplicacionId]
  );
  if (existingResult.rows.length > 0) {
    const existing = existingResult.rows[0];
    if (existing.estado === 'completada') {
      throw new Error('Ya existe una entrevista IA completada para este candidato.');
    }
    return { entrevistaId: existing.id, status: 'initiated' };
  }

  // 3. Build questions list
  const criterios = app.criterios_evaluacion || {};
  const preguntasConfig: PreguntasEntrevistaConfig = criterios.preguntas_entrevista || PREGUNTAS_DEFAULT;
  const preguntas = options?.preguntasCustom || [
    ...preguntasConfig.tecnicas,
    ...preguntasConfig.motivacionales,
    ...preguntasConfig.culturales.slice(0, 1),
    ...preguntasConfig.situacionales.slice(0, 1),
  ];

  // 4. Create interview record
  const entrevistaResult = await pool.query(
    `INSERT INTO entrevistas_ia (aplicacion_id, estado, preguntas_usadas)
     VALUES ($1, 'pendiente', $2)
     RETURNING id`,
    [aplicacionId, JSON.stringify(preguntas)]
  );
  const entrevistaId = entrevistaResult.rows[0].id;

  // 5. Update application state
  await pool.query(
    `UPDATE aplicaciones SET estado = 'entrevista_ia', updated_at = NOW()
     WHERE id = $1 AND estado IN ('nuevo', 'en_revision', 'preseleccionado', 'revisado')`,
    [aplicacionId]
  );

  // 6. Trigger Dapta call
  const daptaClient = createDaptaClient();
  if (!daptaClient) {
    return { entrevistaId, status: 'dapta_not_configured' };
  }

  const callbackUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3500'}/api/webhooks/dapta`;

  const callResult = await daptaClient.triggerInterviewCall({
    candidatoTelefono: app.candidato_telefono,
    candidatoNombre: app.candidato_nombre,
    vacanteTitulo: app.vacante_titulo,
    empresaNombre: app.empresa_nombre,
    preguntas,
    maxDuracionMinutos: options?.maxDuracion || 15,
    contextoAdicional: options?.contextoAdicional,
    aplicacionId: aplicacionId,
    entrevistaId: entrevistaId,
    callbackUrl,
  });
  console.log(`[Entrevista IA] Dapta call result:`, callResult);

  if (callResult.success) {
    await pool.query(
      `UPDATE entrevistas_ia SET
         estado = 'iniciando',
         dapta_call_id = $1,
         fecha_llamada = NOW()
       WHERE id = $2`,
      [callResult.execution_id, entrevistaId]
    );
    return { entrevistaId, status: 'initiated' };
  } else {
    await pool.query(
      `UPDATE entrevistas_ia SET estado = 'fallida' WHERE id = $1`,
      [entrevistaId]
    );
    return { entrevistaId, status: 'error', error: callResult.error };
  }
}

/**
 * Processes a completed call result. Called by the Dapta webhook.
 */
export async function procesarResultadoLlamada(
  payload: DaptaWebhookPayload,
  entrevistaId?: string
): Promise<void> {
  let entrevista;

  if (entrevistaId) {
    const result = await pool.query(
      `SELECT ei.*, a.vacante_id, a.candidato_id, a.id as aplicacion_id,
              v.titulo as vacante_titulo, v.habilidades_requeridas,
              o.name as empresa_nombre, v.organization_id
       FROM entrevistas_ia ei
       JOIN aplicaciones a ON a.id = ei.aplicacion_id
       JOIN vacantes v ON v.id = a.vacante_id
       JOIN organizations o ON o.id = v.organization_id
       WHERE ei.id = $1`,
      [entrevistaId]
    );
    entrevista = result.rows[0];
  } else {
    const result = await pool.query(
      `SELECT ei.*, a.vacante_id, a.candidato_id, a.id as aplicacion_id,
              v.titulo as vacante_titulo, v.habilidades_requeridas,
              o.name as empresa_nombre, v.organization_id
       FROM entrevistas_ia ei
       JOIN aplicaciones a ON a.id = ei.aplicacion_id
       JOIN vacantes v ON v.id = a.vacante_id
       JOIN organizations o ON o.id = v.organization_id
       WHERE ei.dapta_call_id = $1`,
      [payload.call_id]
    );
    entrevista = result.rows[0];
  }

  if (!entrevista) {
    console.error(`[Dapta Webhook] Entrevista no encontrada para call_id: ${payload.call_id}`);
    return;
  }

  // If call failed
  if (payload.status !== 'completed') {
    await pool.query(
      `UPDATE entrevistas_ia SET
         estado = 'fallida',
         duracion_segundos = $1,
         dapta_call_id = COALESCE(dapta_call_id, $2),
         recording_url = $3
       WHERE id = $4`,
      [payload.duration_seconds, payload.call_id, payload.recording_url || null, entrevista.id]
    );
    await pool.query(
      `UPDATE aplicaciones SET
         notas = COALESCE(notas, '') || E'\nEntrevista IA fallida: ' || $1,
         updated_at = NOW()
       WHERE id = $2`,
      [payload.status, entrevista.aplicacion_id]
    );
    return;
  }

  // Save transcript
  await pool.query(
    `UPDATE entrevistas_ia SET
       estado = 'completada',
       transcripcion = $1,
       duracion_segundos = $2,
       dapta_call_id = COALESCE(dapta_call_id, $3),
       fecha_llamada = $4,
       recording_url = $5
     WHERE id = $6`,
    [payload.transcript, payload.duration_seconds, payload.call_id, payload.started_at, payload.recording_url || null, entrevista.id]
  );

  // Analyze transcript with Claude API
  try {
    const habilidades = Array.isArray(entrevista.habilidades_requeridas)
      ? entrevista.habilidades_requeridas.map((s: any) => typeof s === 'string' ? s : s.name)
      : [];

    const analisis = await analizarTranscripcion(
      payload.transcript,
      entrevista.vacante_titulo,
      entrevista.empresa_nombre,
      habilidades
    );

    const scoreTotal = calcularScoreEntrevistaIA(analisis);

    await pool.query(
      `UPDATE entrevistas_ia SET
         analisis = $1,
         score_total = $2
       WHERE id = $3`,
      [JSON.stringify(analisis), scoreTotal, entrevista.id]
    );

    await pool.query(
      `UPDATE aplicaciones SET
         score_ia = $1,
         estado = CASE
           WHEN estado = 'entrevista_ia' THEN 'entrevista_humana'
           ELSE estado
         END,
         notas = COALESCE(notas, '') || E'\nScore Entrevista IA: ' || $4 || '/100 — ' || $2,
         updated_at = NOW()
       WHERE id = $3`,
      [scoreTotal, analisis.recomendacion, entrevista.aplicacion_id, String(scoreTotal)]
    );

    await pool.query(
      `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
       VALUES ($1, 'entrevista_ia', $2, 'completed', $3)`,
      [entrevista.organization_id, entrevista.id, JSON.stringify({
        score: scoreTotal,
        recomendacion: analisis.recomendacion,
        duracion_segundos: payload.duration_seconds,
      })]
    );

  } catch (error) {
    console.error(`[Entrevista IA] Error analizando transcripción ${entrevista.id}:`, error);
  }
}

/**
 * Simulate an IA interview with manual transcript (for testing without Dapta).
 */
export async function procesarTranscripcionManual(
  entrevistaId: string,
  transcripcion: string,
): Promise<void> {
  await procesarResultadoLlamada({
    call_id: `manual-${entrevistaId}`,
    status: 'completed',
    transcript: transcripcion,
    duration_seconds: 0,
    from_number: 'manual',
    to_number: 'manual',
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
  }, entrevistaId);
}

/**
 * Get full report for an IA interview.
 */
export async function getEntrevistaIAReport(entrevistaId: string, orgId: string): Promise<EntrevistaIA | null> {
  const result = await pool.query(
    `SELECT ei.*,
            json_build_object('id', c.id, 'nombre', c.nombre, 'email', c.email, 'telefono', c.telefono) as candidato,
            json_build_object('id', v.id, 'titulo', v.titulo) as vacante
     FROM entrevistas_ia ei
     JOIN aplicaciones a ON a.id = ei.aplicacion_id
     JOIN candidatos c ON c.id = a.candidato_id
     JOIN vacantes v ON v.id = a.vacante_id
     WHERE ei.id = $1 AND v.organization_id = $2`,
    [entrevistaId, orgId]
  );
  return result.rows[0] || null;
}

/**
 * List IA interviews for a vacancy.
 */
export async function listEntrevistasIA(
  orgIdOrVacanteId: string,
  vacanteIdOrUndefined?: string
): Promise<EntrevistaIA[]> {
  // Support both (orgId, vacanteId?) and (vacanteId, orgId) call patterns
  let vacanteId: string | undefined;
  let orgId: string;

  if (vacanteIdOrUndefined) {
    // Called as listEntrevistasIA(vacanteId, orgId) from new service
    // or listEntrevistasIA(orgId, vacanteId) from old API
    // Detect by checking if second param looks like it could be orgId
    orgId = orgIdOrVacanteId;
    vacanteId = vacanteIdOrUndefined;
  } else {
    orgId = orgIdOrVacanteId;
  }

  let query = `
    SELECT ei.*,
            json_build_object('id', c.id, 'nombre', c.nombre, 'email', c.email, 'telefono', c.telefono) as candidato,
            json_build_object('id', v.id, 'titulo', v.titulo) as vacante,
            c.nombre as candidato_nombre, c.apellido as candidato_apellido,
            v.titulo as vacante_titulo
     FROM entrevistas_ia ei
     JOIN aplicaciones a ON a.id = ei.aplicacion_id
     JOIN candidatos c ON c.id = a.candidato_id
     JOIN vacantes v ON v.id = a.vacante_id
     WHERE v.organization_id = $1`;

  const params: unknown[] = [orgId];

  if (vacanteId) {
    query += ' AND a.vacante_id = $2';
    params.push(vacanteId);
  }

  query += ' ORDER BY ei.score_total DESC NULLS LAST, ei.created_at DESC';

  const result = await pool.query(query, params);
  return result.rows;
}

// ─── Backward compat for old API route ───

export async function createEntrevistaIA(
  orgId: UUID,
  input: { aplicacion_id: UUID; candidato_id: UUID; vacante_id: UUID }
): Promise<EntrevistaIA> {
  const result = await pool.query<EntrevistaIA>(
    `INSERT INTO entrevistas_ia (aplicacion_id, organization_id, candidato_id, vacante_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [input.aplicacion_id, orgId, input.candidato_id, input.vacante_id]
  );
  return result.rows[0];
}

export async function getEntrevistaIA(orgId: UUID, entrevistaId: UUID): Promise<EntrevistaIAConDetalles> {
  const result = await pool.query<EntrevistaIAConDetalles>(
    `SELECT ei.*,
      c.nombre as candidato_nombre, c.apellido as candidato_apellido,
      v.titulo as vacante_titulo
    FROM entrevistas_ia ei
    JOIN aplicaciones a ON a.id = ei.aplicacion_id
    JOIN candidatos c ON c.id = a.candidato_id
    JOIN vacantes v ON v.id = a.vacante_id
    WHERE ei.id = $1 AND v.organization_id = $2`,
    [entrevistaId, orgId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Entrevista IA', entrevistaId);
  return result.rows[0];
}

export async function updateEntrevistaIA(
  orgId: UUID,
  entrevistaId: UUID,
  updates: Record<string, unknown>
): Promise<EntrevistaIA> {
  const fields: string[] = [];
  const params: unknown[] = [entrevistaId, orgId];
  let paramIndex = 3;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      if (key === 'analisis') {
        fields.push(`${key} = $${paramIndex++}`);
        params.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${paramIndex++}`);
        params.push(value);
      }
    }
  }

  fields.push('updated_at = NOW()');

  const result = await pool.query<EntrevistaIA>(
    `UPDATE entrevistas_ia SET ${fields.join(', ')}
     FROM aplicaciones a
     JOIN vacantes v ON v.id = a.vacante_id
     WHERE entrevistas_ia.id = $1 AND entrevistas_ia.aplicacion_id = a.id AND v.organization_id = $2
     RETURNING entrevistas_ia.*`,
    params
  );
  if (result.rows.length === 0) throw new NotFoundError('Entrevista IA', entrevistaId);
  return result.rows[0];
}
