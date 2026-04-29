import { NextRequest } from 'next/server';
import { getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { obtenerPregunta, actualizarPregunta } from '@/lib/services/banco-preguntas.service';
import { preguntaUpdateSchema } from '@/lib/validations/evaluacion.schema';
import { NotFoundError } from '@/lib/utils/errors';

export const maxDuration = 10;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId();
    const pregunta = await obtenerPregunta(params.id, orgId);
    if (!pregunta) throw new NotFoundError('Pregunta', params.id);
    return apiResponse(pregunta);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId();
    const body = await request.json();
    const validated = preguntaUpdateSchema.parse(body);
    const pregunta = await actualizarPregunta(params.id, orgId, validated);
    return apiResponse(pregunta);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId();
    const pregunta = await actualizarPregunta(params.id, orgId, { estado: 'archivada' } as any);
    return apiResponse(pregunta);
  } catch (error) {
    return apiError(error);
  }
}
