import { NextRequest } from 'next/server';
import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { listContratos, createContrato } from '@/lib/services/contratos.service';
import { contratoCreateSchema } from '@/lib/validations/contrato.schema';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);

    const contratos = await listContratos(orgId, {
      estado: searchParams.get('estado') || undefined,
      tipo: searchParams.get('tipo') || undefined,
      search: searchParams.get('search') || undefined,
    });
    return apiResponse(contratos);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const userId = await getUserId();
    const body = await request.json();
    const validated = contratoCreateSchema.parse(body);
    const contrato = await createContrato(orgId, userId, validated);
    return apiResponse(contrato, 201);
  } catch (error) {
    return apiError(error);
  }
}
