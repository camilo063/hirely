import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { getTipoContrato, updateTipoContrato, deleteTipoContrato } from '@/lib/services/tipos-contrato.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    const tipo = await getTipoContrato(orgId, id);
    if (!tipo) return apiError(new Error('Tipo de contrato no encontrado'));
    return apiResponse(tipo);
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
    const orgId = await getOrgId();
    const { id } = await params;
    const body = await request.json();
    const tipo = await updateTipoContrato(orgId, id, body);
    return apiResponse(tipo);
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
    const orgId = await getOrgId();
    const { id } = await params;
    await deleteTipoContrato(orgId, id);
    return apiResponse({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
