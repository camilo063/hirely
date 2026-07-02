import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { actualizarCampo, eliminarCampo } from '@/lib/services/evaluacion-humana-campos.service';

export const maxDuration = 10;

// PUT /api/configuracion/evaluacion-campos/[id] — actualiza un campo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const campo = await actualizarCampo(orgId, id, {
      label: body.label,
      descripcion: body.descripcion,
      orden: body.orden,
      min_valor: body.min_valor,
      max_valor: body.max_valor,
      activo: body.activo,
    });

    if (!campo) {
      return apiResponse({ error: 'Campo no encontrado' }, 404);
    }

    return apiResponse(campo);
  } catch (error) {
    return apiError(error);
  }
}

// DELETE /api/configuracion/evaluacion-campos/[id] — elimina un campo
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;

    const deleted = await eliminarCampo(orgId, id);
    if (!deleted) {
      return apiResponse({ error: 'Campo no encontrado' }, 404);
    }

    return apiResponse({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
