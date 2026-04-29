import { NextRequest } from 'next/server';
import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { iniciarEntrevistaIA, listEntrevistasIA, createEntrevistaIA } from '@/lib/services/entrevista-ia.service';
import { listEntrevistasHumanas, createEntrevistaHumana } from '@/lib/services/entrevista-humana.service';
import { entrevistaIACreateSchema, entrevistaHumanaCreateSchema } from '@/lib/validations/entrevista.schema';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'all';
    const vacanteId = searchParams.get('vacante_id') || undefined;

    const result: Record<string, unknown> = {};

    if (tipo === 'ia' || tipo === 'all') {
      result.entrevistas_ia = await listEntrevistasIA(orgId, vacanteId);
    }
    if (tipo === 'humana' || tipo === 'all') {
      result.entrevistas_humanas = await listEntrevistasHumanas(orgId, vacanteId);
    }

    return apiResponse(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const body = await request.json();
    const tipo = body.tipo;

    if (tipo === 'ia') {
      // New flow: use iniciarEntrevistaIA if aplicacion_id provided without candidato_id
      if (body.aplicacion_id && !body.candidato_id) {
        const result = await iniciarEntrevistaIA(
          body.aplicacion_id,
          orgId,
          {
            preguntasCustom: body.preguntas,
            maxDuracion: body.max_duracion,
            contextoAdicional: body.contexto,
          }
        );
        return apiResponse(result, result.status === 'error' ? 500 : 201);
      }
      // Legacy flow: create with full input
      const validated = entrevistaIACreateSchema.parse(body);
      const entrevista = await createEntrevistaIA(orgId, validated);
      return apiResponse(entrevista, 201);
    } else if (tipo === 'humana') {
      const userId = await getUserId();
      const validated = entrevistaHumanaCreateSchema.parse(body);
      const entrevista = await createEntrevistaHumana(orgId, { ...validated, crear_evento_calendar: body.crear_evento_calendar }, userId);
      return apiResponse(entrevista, 201);
    } else {
      // Default: treat as iniciarEntrevistaIA for backward compat
      if (body.aplicacion_id) {
        const result = await iniciarEntrevistaIA(
          body.aplicacion_id,
          orgId,
          {
            preguntasCustom: body.preguntas,
            maxDuracion: body.max_duracion,
            contextoAdicional: body.contexto,
          }
        );
        return apiResponse(result, result.status === 'error' ? 500 : 201);
      }
      return apiError(new Error('Tipo de entrevista invalido. Use "ia" o "humana", o proporcione aplicacion_id'));
    }
  } catch (error) {
    return apiError(error);
  }
}
