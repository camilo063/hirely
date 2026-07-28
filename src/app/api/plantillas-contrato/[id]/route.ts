import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { getPlantilla, updatePlantilla, deletePlantilla } from '@/lib/services/contratos.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { requireEscritura } from '@/lib/auth/authorization';
import { sanitizarHtml } from '@/lib/utils/sanitize-html';

export const maxDuration = 10;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    const plantilla = await getPlantilla(orgId, id);
    return apiResponse(plantilla);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    // Escritura del pipeline: un rol de solo lectura no debe mutar datos.
    await requireEscritura();
    const orgId = await getOrgId();
    const { id } = await params;
    const body = await request.json();

    const plantilla = await updatePlantilla(orgId, id, {
      nombre: body.nombre,
      // Se sanea al guardar: este HTML se pinta luego con dangerouslySetInnerHTML.
      contenido_html: sanitizarHtml(body.contenido_html),
      variables: body.variables,
      is_active: body.is_active,
    });
    return apiResponse(plantilla);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    // Escritura del pipeline: un rol de solo lectura no debe mutar datos.
    await requireEscritura();
    const orgId = await getOrgId();
    const { id } = await params;
    await deletePlantilla(orgId, id);
    return apiResponse({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
