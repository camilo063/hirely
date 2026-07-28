import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { runScoringPipeline } from '@/lib/services/scoring-pipeline.service';
import { calculateAtsScore, updateAplicacionScore } from '@/lib/services/scoring-ats.service';
import { pool } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { requireEscritura } from '@/lib/auth/authorization';

/**
 * POST /api/candidatos/[id]/score
 * Body: { vacante_id: string }
 *
 * Ejecuta el pipeline de scoring completo para un candidato.
 * Si el CV no esta parseado, lo parsea primero.
 */
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    // Escritura del pipeline: un rol de solo lectura no debe mutar datos.
    await requireEscritura();
    const orgId = await getOrgId();
    const { id: candidatoId } = await params;

    const body = await request.json();
    const { vacante_id, aplicacion_id } = body;

    // New pipeline mode: candidato + vacante
    if (vacante_id) {
      try {
        const result = await runScoringPipeline(candidatoId, vacante_id, orgId);
        return apiResponse(result);
      } catch (pipelineError: any) {
        const msg = (pipelineError?.message || 'Error desconocido en scoring').toString();
        console.error(`[Score Route] Pipeline fallo candidato=${candidatoId} vacante=${vacante_id}:`, pipelineError);
        try {
          // El guard de organizacion tambien va en la ruta de ERROR. Sin el,
          // forzar un fallo (pasando un candidato que no es de la vacante) era
          // suficiente para escribir texto controlado en `score_ats_error` de la
          // aplicacion de otra empresa e incrementar su contador de intentos.
          await pool.query(
            `UPDATE aplicaciones SET
               score_ats_error = $1,
               score_ats_intentos = COALESCE(score_ats_intentos, 0) + 1
             WHERE candidato_id = $2 AND vacante_id = $3
               AND EXISTS (
                 SELECT 1 FROM vacantes v
                 WHERE v.id = aplicaciones.vacante_id AND v.organization_id = $4
               )`,
            [msg.substring(0, 500), candidatoId, vacante_id, orgId]
          );
        } catch (dbErr) {
          console.error('[Score Route] No se pudo persistir score_ats_error:', dbErr);
        }
        throw pipelineError;
      }
    }

    // Legacy mode: aplicacion_id
    if (aplicacion_id) {
      const result = await calculateAtsScore(orgId, aplicacion_id);
      await updateAplicacionScore(orgId, aplicacion_id, result.score_total);
      return apiResponse(result);
    }

    // Default: try to find aplicacion by candidato ID
    const result = await calculateAtsScore(orgId, candidatoId);
    await updateAplicacionScore(orgId, candidatoId, result.score_total);
    return apiResponse(result);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * GET /api/candidatos/[id]/score?vacante_id=xxx
 *
 * Obtiene el score ATS actual del candidato para una vacante.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id: candidatoId } = await params;

    const vacanteId = request.nextUrl.searchParams.get('vacante_id');

    if (vacanteId) {
      // El JOIN a vacantes acota por organizacion. Sin el, dos UUID (candidato
      // y vacante) bastaban para leer los scores de otra empresa sin ningun
      // paso previo.
      const result = await pool.query(
        `SELECT a.score_ats, a.score_ats_breakdown, a.score_ats_resumen, a.scored_at,
                a.score_ia, a.score_humano, a.score_final
         FROM aplicaciones a
         JOIN vacantes v ON v.id = a.vacante_id
         WHERE a.candidato_id = $1 AND a.vacante_id = $2 AND v.organization_id = $3`,
        [candidatoId, vacanteId, orgId]
      );

      if (result.rows.length === 0) {
        return apiError(new Error('Aplicacion no encontrada'));
      }

      return apiResponse(result.rows[0]);
    }

    // Fallback: legacy mode using candidato ID as aplicacion ID
    const result = await calculateAtsScore(orgId, candidatoId);
    return apiResponse(result);
  } catch (error) {
    return apiError(error);
  }
}
