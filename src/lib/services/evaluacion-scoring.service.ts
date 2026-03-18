import { createAnthropicClient } from '@/lib/integrations/anthropic.client';
import type {
  PreguntaAsignadaConRespuesta,
  RespuestaCandidato,
  ScoreDetalle,
  OpcionPregunta,
} from '@/lib/types/evaluacion-tecnica.types';

/**
 * Motor de calificación automática para evaluaciones técnicas.
 *
 * - opcion_multiple: comparación directa con respuesta correcta → 100% o 0%
 * - verdadero_falso: comparación directa → 100% o 0%
 * - respuesta_abierta: scoring con Claude AI (0-100)
 * - codigo: scoring con Claude AI (0-100)
 */

export async function calcularScoreEvaluacion(
  preguntas: PreguntaAsignadaConRespuesta[],
  respuestas: RespuestaCandidato[],
  puntajeAprobatorio: number
): Promise<{ score_total: number; detalle: ScoreDetalle; aprobada: boolean }> {
  const respuestaMap = new Map<string, RespuestaCandidato>();
  for (const r of respuestas) {
    respuestaMap.set(r.pregunta_id, r);
  }

  const detalle: ScoreDetalle = {};
  let puntosObtenidos = 0;
  let puntosPosibles = 0;

  for (const pregunta of preguntas) {
    const respuesta = respuestaMap.get(pregunta.pregunta_id);
    const cat = pregunta.categoria;

    if (!detalle[cat]) {
      detalle[cat] = { correctas: 0, total: 0, score: 0, puntos_obtenidos: 0, puntos_posibles: 0 };
    }
    detalle[cat].total++;
    detalle[cat].puntos_posibles += pregunta.puntos;
    puntosPosibles += pregunta.puntos;

    if (!respuesta) continue;

    let scorePregunta = 0;

    switch (pregunta.tipo) {
      case 'opcion_multiple': {
        const opciones: OpcionPregunta[] = typeof pregunta.opciones === 'string'
          ? JSON.parse(pregunta.opciones)
          : pregunta.opciones || [];
        const correcta = opciones.find(o => o.es_correcta);
        if (correcta && respuesta.respuesta === correcta.id) {
          scorePregunta = 1;
        }
        break;
      }
      case 'verdadero_falso': {
        if (respuesta.respuesta === pregunta.respuesta_correcta) {
          scorePregunta = 1;
        }
        break;
      }
      case 'respuesta_abierta':
      case 'codigo': {
        // Try AI scoring, fallback to partial credit
        try {
          const aiResult = await scorearRespuestaAbierta(
            pregunta.enunciado,
            respuesta.respuesta,
            pregunta.respuesta_correcta || '',
            pregunta.tipo
          );
          scorePregunta = aiResult.score / 100;
        } catch {
          // If AI not available, give 50% partial credit for any non-empty answer
          scorePregunta = respuesta.respuesta.trim().length > 10 ? 0.5 : 0;
        }
        break;
      }
    }

    const puntosGanados = Math.round(scorePregunta * pregunta.puntos);
    puntosObtenidos += puntosGanados;
    detalle[cat].puntos_obtenidos += puntosGanados;

    if (scorePregunta >= 0.5) {
      detalle[cat].correctas++;
    }
  }

  // Calculate per-category scores
  for (const cat of Object.keys(detalle)) {
    detalle[cat].score = detalle[cat].puntos_posibles > 0
      ? Math.round((detalle[cat].puntos_obtenidos / detalle[cat].puntos_posibles) * 100)
      : 0;
  }

  const scoreTotal = puntosPosibles > 0
    ? Math.round((puntosObtenidos / puntosPosibles) * 100)
    : 0;

  return {
    score_total: scoreTotal,
    detalle,
    aprobada: scoreTotal >= puntajeAprobatorio,
  };
}

/**
 * Scoring con IA para preguntas abiertas y de código.
 */
export async function scorearRespuestaAbierta(
  enunciado: string,
  respuestaCandidato: string,
  guiaEvaluacion: string,
  tipo: 'respuesta_abierta' | 'codigo'
): Promise<{ score: number; feedback: string }> {
  const client = createAnthropicClient();
  if (!client) {
    throw new Error('Claude API no configurada');
  }

  const systemPrompt = tipo === 'codigo'
    ? `Eres un evaluador técnico de código. Evalúa la respuesta del candidato considerando:
- Correctitud lógica (40%)
- Sintaxis y buenas prácticas (20%)
- Eficiencia (20%)
- Claridad y legibilidad (20%)

Responde SOLO con un JSON: {"score": <0-100>, "feedback": "<breve explicación>"}`
    : `Eres un evaluador de respuestas técnicas. Evalúa la respuesta del candidato considerando:
- Precisión y exactitud (40%)
- Profundidad de conocimiento (30%)
- Claridad de comunicación (30%)

Responde SOLO con un JSON: {"score": <0-100>, "feedback": "<breve explicación>"}`;

  const userMessage = `**Pregunta:** ${enunciado}

**Guía de evaluación:** ${guiaEvaluacion || 'Evaluar según criterios generales del dominio.'}

**Respuesta del candidato:**
${respuestaCandidato}`;

  const response = await client.complete(systemPrompt, [
    { role: 'user', content: userMessage },
  ], { maxTokens: 500, temperature: 0 });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
        feedback: parsed.feedback || '',
      };
    }
  } catch {
    // Parse error
  }

  return { score: 50, feedback: 'Evaluación automática no disponible' };
}
