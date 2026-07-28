import { NextRequest } from 'next/server';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import {
  obtenerEvaluacionPorToken,
  iniciarEvaluacion,
  guardarRespuestas,
} from '@/lib/services/evaluacion-tecnica.service';
import { respuestasSubmitSchema } from '@/lib/validations/evaluacion.schema';
import { rateLimit, respuesta429 } from '@/lib/utils/rate-limit';

/**
 * PUBLIC endpoint - no auth required.
 * Candidates access via token from email link.
 */

export const maxDuration = 15;

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    // Sin freno, el token (que va en la URL del correo) permite reintentos
    // ilimitados desde cualquier cliente.
    const rl = await rateLimit({
      clave: `respEval:GET:${params.token}`,
      limite: 60,
      ventanaSegundos: 300,
    });
    if (!rl.permitido) return respuesta429(rl.reintentarEn);

    const result = await obtenerEvaluacionPorToken(params.token);
    if (!result) {
      return apiResponse({ error: 'Evaluación no encontrada o token inválido' }, 404);
    }
    return apiResponse(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const rl = await rateLimit({
      clave: `respEval:POST:${params.token}`,
      limite: 30,
      ventanaSegundos: 300,
    });
    if (!rl.permitido) return respuesta429(rl.reintentarEn);

    const body = await request.json();

    // Action: start or submit
    if (body.action === 'iniciar') {
      await iniciarEvaluacion(params.token);
      return apiResponse({ message: 'Evaluación iniciada' });
    }

    // Submit answers
    const validated = respuestasSubmitSchema.parse(body);
    const result = await guardarRespuestas(params.token, validated.respuestas);
    return apiResponse(result);
  } catch (error) {
    return apiError(error);
  }
}
