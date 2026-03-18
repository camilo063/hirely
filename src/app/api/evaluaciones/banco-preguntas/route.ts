import { NextRequest } from 'next/server';
import { getOrgId, getUserId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { listarPreguntas, crearPregunta } from '@/lib/services/banco-preguntas.service';
import { preguntaCreateSchema } from '@/lib/validations/evaluacion.schema';
import type { Dificultad, TipoPregunta, EstadoPregunta } from '@/lib/types/evaluacion-tecnica.types';

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);

    const result = await listarPreguntas({
      organization_id: orgId,
      categoria: searchParams.get('categoria') || undefined,
      dificultad: (searchParams.get('dificultad') as Dificultad) || undefined,
      tipo: (searchParams.get('tipo') as TipoPregunta) || undefined,
      estado: (searchParams.get('estado') as EstadoPregunta) || undefined,
      es_estandar: searchParams.has('es_estandar') ? searchParams.get('es_estandar') === 'true' : undefined,
      busqueda: searchParams.get('busqueda') || undefined,
      cargo: searchParams.get('cargo') || undefined,
      tags: searchParams.get('tags') ? searchParams.get('tags')!.split(',') : undefined,
      page: Number(searchParams.get('page')) || 1,
      limit: Number(searchParams.get('limit')) || 50,
    });

    return apiResponse(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const userId = await getUserId();
    const body = await request.json();
    const validated = preguntaCreateSchema.parse(body);

    const pregunta = await crearPregunta(orgId, validated, userId);
    return apiResponse(pregunta, 201);
  } catch (error) {
    return apiError(error);
  }
}
