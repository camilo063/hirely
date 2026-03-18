import { NextRequest } from 'next/server';
import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { listVacantes, createVacante } from '@/lib/services/vacantes.service';
import { vacanteCreateSchema } from '@/lib/validations/vacante.schema';
import { apiResponse, apiError, paginatedResponse } from '@/lib/utils/api-response';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);

    const filters = {
      estado: searchParams.get('estado') || undefined,
      departamento: searchParams.get('departamento') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const pagination = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    };

    const result = await listVacantes(orgId, filters, pagination);
    return paginatedResponse(result.data, result.total, result.page, result.limit);
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
    const validated = vacanteCreateSchema.parse(body);
    const vacante = await createVacante(orgId, userId, validated);
    return apiResponse(vacante, 201);
  } catch (error) {
    return apiError(error);
  }
}
