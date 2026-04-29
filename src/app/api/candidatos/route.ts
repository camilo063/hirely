import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { listCandidatos, createCandidato } from '@/lib/services/candidatos.service';
import { candidatoCreateSchema } from '@/lib/validations/candidato.schema';
import { apiResponse, apiError, paginatedResponse } from '@/lib/utils/api-response';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);

    const estadoParam = searchParams.get('estado');

    const filters = {
      search: searchParams.get('search') || undefined,
      habilidad: searchParams.get('habilidad') || undefined,
      fuente: searchParams.get('fuente') || undefined,
      vacanteId: searchParams.get('vacante_id') || undefined,
      estado: estadoParam ? estadoParam.split(',') : undefined,
      scoreRange: searchParams.get('score_range') || undefined,
    };

    const pagination = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    };

    const result = await listCandidatos(orgId, filters, pagination);
    return paginatedResponse(result.data, result.total, result.page, result.limit);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const body = await request.json();
    const validated = candidatoCreateSchema.parse(body);
    const candidato = await createCandidato(orgId, validated);
    return apiResponse(candidato, 201);
  } catch (error) {
    return apiError(error);
  }
}
