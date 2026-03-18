import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { listTiposContrato, createTipoContrato } from '@/lib/services/tipos-contrato.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const tipos = await listTiposContrato(orgId);
    return apiResponse(tipos);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const body = await request.json();

    if (!body.nombre?.trim()) {
      return apiError(new Error('El nombre es requerido'));
    }

    const tipo = await createTipoContrato(orgId, {
      nombre: body.nombre.trim(),
      slug: body.slug?.trim() || undefined,
      descripcion: body.descripcion?.trim() || undefined,
    });
    return apiResponse(tipo);
  } catch (error) {
    return apiError(error);
  }
}
