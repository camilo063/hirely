import { NextRequest } from 'next/server';
import { getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { generarPreguntasConIA } from '@/lib/services/generar-preguntas-ia.service';
import { z } from 'zod';

const generarPreguntasIASchema = z.object({
  categoria: z.string().min(1),
  subcategoria: z.string().optional(),
  tipos: z.array(z.enum(['opcion_multiple', 'verdadero_falso', 'respuesta_abierta', 'codigo'])).min(1),
  dificultad: z.enum(['basico', 'intermedio', 'avanzado', 'experto']),
  cantidad: z.number().int().min(1).max(10),
  puntos_por_pregunta: z.number().int().min(1).default(10),
  cargo_objetivo: z.string().optional(),
  idioma: z.enum(['es', 'en']).default('es'),
  instrucciones_adicionales: z.string().optional(),
});

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    await getOrgId(); // Validate auth
    const body = await request.json();
    const validated = generarPreguntasIASchema.parse(body);

    const preguntas = await generarPreguntasConIA(validated);
    return apiResponse({ preguntas });
  } catch (error) {
    return apiError(error);
  }
}
