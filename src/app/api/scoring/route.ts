import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { rescoreAllCandidatos } from '@/lib/services/scoring-pipeline.service';
import { calculateScoreDual, batchCalculateScoreDual } from '@/lib/services/scoring-dual.service';
import { batchScoreVacante } from '@/lib/services/scoring-ats.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

/**
 * POST /api/scoring
 * Body: { tipo, vacante_id, aplicacion_id }
 *
 * Scoring masivo y recalculo:
 * - tipo: 'ats_pipeline' — Full pipeline (parse + score) para todos los candidatos
 * - tipo: 'ats' — Legacy ATS batch scoring
 * - tipo: 'dual' — Single dual scoring
 * - tipo: 'dual_batch' — Batch dual scoring
 */
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const body = await request.json();
    const { tipo, aplicacion_id, vacante_id } = body;

    if (tipo === 'ats_pipeline' && vacante_id) {
      const result = await rescoreAllCandidatos(vacante_id, orgId);
      return apiResponse({
        ...result,
        message: `Scoring completado: ${result.exitosos}/${result.total} candidatos procesados`,
      });
    }

    if (tipo === 'ats' && vacante_id) {
      const scored = await batchScoreVacante(orgId, vacante_id);
      return apiResponse({ scored, message: `${scored} aplicaciones evaluadas con ATS` });
    }

    if (tipo === 'dual' && aplicacion_id) {
      const result = await calculateScoreDual(orgId, aplicacion_id);
      return apiResponse(result);
    }

    if (tipo === 'dual_batch' && vacante_id) {
      const calculated = await batchCalculateScoreDual(orgId, vacante_id);
      return apiResponse({ calculated, message: `${calculated} scores duales calculados` });
    }

    return apiError(new Error('Especifique tipo (ats_pipeline, ats, dual, dual_batch) y los IDs correspondientes'));
  } catch (error) {
    return apiError(error);
  }
}
