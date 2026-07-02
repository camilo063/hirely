import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import {
  getPipelineEstadosConfig,
  updatePipelineEstadosConfig,
} from '@/lib/services/pipeline-config.service';

// GET /api/configuracion/pipeline-estados — catalogo de estados de la org (merge)
export const maxDuration = 10;

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    return apiResponse({ estados: await getPipelineEstadosConfig(orgId) });
  } catch (error) {
    return apiError(error);
  }
}

// PUT /api/configuracion/pipeline-estados — guarda overrides (label/orden/activo)
export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const body = await request.json();

    const estados = Array.isArray(body.estados) ? body.estados : [];
    await updatePipelineEstadosConfig(orgId, estados);

    return apiResponse({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
