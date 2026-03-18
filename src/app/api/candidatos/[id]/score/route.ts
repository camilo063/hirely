import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { runScoringPipeline } from '@/lib/services/scoring-pipeline.service';
import { calculateAtsScore, updateAplicacionScore } from '@/lib/services/scoring-ats.service';
import { pool } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils/api-response';

/**
 * POST /api/candidatos/[id]/score
 * Body: { vacante_id: string }
 *
 * Ejecuta el pipeline de scoring completo para un candidato.
 * Si el CV no esta parseado, lo parsea primero.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id: candidatoId } = await params;

    const body = await request.json();
    const { vacante_id, aplicacion_id } = body;

    // New pipeline mode: candidato + vacante
    if (vacante_id) {
      const result = await runScoringPipeline(candidatoId, vacante_id, orgId);
      return apiResponse(result);
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
      const result = await pool.query(
        `SELECT score_ats, score_ats_breakdown, score_ats_resumen, scored_at,
                score_ia, score_humano, score_final
         FROM aplicaciones
         WHERE candidato_id = $1 AND vacante_id = $2`,
        [candidatoId, vacanteId]
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
