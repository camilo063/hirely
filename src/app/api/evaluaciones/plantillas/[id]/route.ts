import { NextRequest } from 'next/server';
import { getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { obtenerPlantilla, actualizarPlantilla } from '@/lib/services/evaluacion-tecnica.service';
import { plantillaUpdateSchema } from '@/lib/validations/evaluacion.schema';

export const maxDuration = 10;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId();
    const plantilla = await obtenerPlantilla(params.id, orgId);
    return apiResponse(plantilla);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId();
    const body = await request.json();
    const validated = plantillaUpdateSchema.parse(body);
    const plantilla = await actualizarPlantilla(params.id, orgId, validated);
    return apiResponse(plantilla);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId();
    const plantilla = await actualizarPlantilla(params.id, orgId, { estado: 'archivada' } as any);
    return apiResponse(plantilla);
  } catch (error) {
    return apiError(error);
  }
}
