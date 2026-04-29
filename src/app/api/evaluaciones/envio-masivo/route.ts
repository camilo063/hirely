import { NextRequest } from 'next/server';
import { getOrgId, getUserId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';
import { crearEvaluacion, enviarEvaluacion, obtenerPlantilla } from '@/lib/services/evaluacion-tecnica.service';
import { z } from 'zod';

const envioMasivoSchema = z.object({
  vacante_id: z.string().uuid(),
  plantilla_id: z.string().uuid(),
  candidatos_ids: z.array(z.string().uuid()).optional(),
});

const MAX_BATCH = 50;

/**
 * POST /api/evaluaciones/envio-masivo
 * Sends technical evaluations to all eligible candidates for a vacante.
 */
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const userId = await getUserId();
    const body = await request.json();
    const { vacante_id, plantilla_id, candidatos_ids } = envioMasivoSchema.parse(body);

    // Fetch plantilla to get evaluation config
    const plantilla = await obtenerPlantilla(plantilla_id, orgId);

    // Query candidates filtered by selected IDs
    if (!candidatos_ids || candidatos_ids.length === 0) {
      return apiResponse({ enviados: 0, omitidos: 0, errores: ['No se seleccionaron candidatos'] });
    }

    if (candidatos_ids.length > MAX_BATCH) {
      return apiResponse({ error: `Maximo ${MAX_BATCH} candidatos por lote` }, 400);
    }

    const { rows: elegibles } = await pool.query(
      `SELECT a.id as aplicacion_id, a.candidato_id, c.nombre, c.email
       FROM aplicaciones a
       JOIN candidatos c ON c.id = a.candidato_id
       WHERE a.vacante_id = $1 AND a.organization_id = $2
         AND a.id = ANY($3)`,
      [vacante_id, orgId, candidatos_ids]
    );

    if (elegibles.length === 0) {
      return apiResponse({ enviados: 0, omitidos: 0, errores: [] });
    }

    let enviados = 0;
    let omitidos = 0;
    const errores: string[] = [];

    for (const candidato of elegibles) {
      try {
        // Create evaluation using existing service
        const evaluacion = await crearEvaluacion({
          organization_id: orgId,
          aplicacion_id: candidato.aplicacion_id,
          candidato_id: candidato.candidato_id,
          vacante_id,
          plantilla_id,
          titulo: plantilla.nombre,
          duracion_minutos: plantilla.duracion_minutos,
          puntaje_aprobatorio: plantilla.puntaje_aprobatorio,
          estructura: typeof plantilla.estructura === 'string'
            ? JSON.parse(plantilla.estructura)
            : plantilla.estructura,
          asignado_por: userId,
        });

        // Send evaluation using existing service
        await enviarEvaluacion(evaluacion.id, orgId);
        enviados++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        errores.push(`${candidato.nombre} (${candidato.email}): ${msg}`);
        omitidos++;
      }
    }

    return apiResponse({ enviados, omitidos, errores });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * GET /api/evaluaciones/envio-masivo?vacante_id=xxx
 * Returns list of candidates for the vacante with their evaluation status.
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);
    const vacante_id = searchParams.get('vacante_id');

    if (!vacante_id) {
      return apiResponse({ candidatos: [] });
    }

    const { rows } = await pool.query(
      `SELECT
         a.id as aplicacion_id,
         a.candidato_id,
         c.nombre,
         COALESCE(c.apellido, '') as apellido,
         c.email,
         a.estado,
         -- Last evaluation info (if any)
         last_eval.estado as eval_previa_estado,
         last_eval.score_total as eval_previa_score,
         last_eval.completada_at as eval_previa_fecha,
         -- Has evaluation currently in progress?
         EXISTS (
           SELECT 1 FROM evaluaciones e
           WHERE e.aplicacion_id = a.id AND e.estado = 'en_progreso'
         ) as tiene_eval_activa
       FROM aplicaciones a
       JOIN candidatos c ON c.id = a.candidato_id
       LEFT JOIN LATERAL (
         SELECT e.estado, e.score_total, e.completada_at
         FROM evaluaciones e
         WHERE e.aplicacion_id = a.id
         ORDER BY e.created_at DESC
         LIMIT 1
       ) last_eval ON true
       WHERE a.vacante_id = $1 AND a.organization_id = $2
       ORDER BY c.nombre
       LIMIT 100`,
      [vacante_id, orgId]
    );

    return apiResponse({ candidatos: rows });
  } catch (error) {
    return apiError(error);
  }
}
