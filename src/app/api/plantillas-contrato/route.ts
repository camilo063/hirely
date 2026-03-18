import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { listPlantillas, createPlantilla } from '@/lib/services/contratos.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { ValidationError } from '@/lib/utils/errors';

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const plantillas = await listPlantillas(orgId);
    return apiResponse(plantillas);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const body = await request.json();

    if (!body.nombre || !body.tipo || !body.contenido_html) {
      throw new ValidationError('nombre, tipo y contenido_html son requeridos');
    }

    const plantilla = await createPlantilla(orgId, {
      nombre: body.nombre,
      tipo: body.tipo,
      contenido_html: body.contenido_html,
      variables: body.variables || [],
    });
    return apiResponse(plantilla, 201);
  } catch (error) {
    return apiError(error);
  }
}
