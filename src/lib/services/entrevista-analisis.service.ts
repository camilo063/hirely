import { createAnthropicClient } from '@/lib/integrations/anthropic.client';
import { parseJsonResponse } from '@/lib/utils/parse-json-response';
import type { EntrevistaIAAnalisis } from '@/lib/types/entrevista.types';

/**
 * Analiza la transcripción de una entrevista IA usando Claude API.
 * Genera scores por 5 dimensiones con evidencia textual.
 */

const ANALISIS_SYSTEM_PROMPT = `Eres un experto en recursos humanos especializado en evaluación de candidatos. Tu trabajo es analizar la transcripción de una entrevista laboral y evaluar al candidato en 5 dimensiones.

REGLAS ESTRICTAS:
- Evalúa ÚNICAMENTE basándote en lo que el candidato dijo en la entrevista
- NO inventes información que no esté en la transcripción
- Cada score debe estar respaldado por evidencia textual (citas del candidato)
- Sé objetivo y justo — no penalizar por nerviosismo normal
- Sé específico en las justificaciones, no genérico
- Las "red_flags" son solo para problemas serios (mentiras, actitud negativa, etc.)
- La recomendación debe ser coherente con los scores

RESPONDE ÚNICAMENTE con un objeto JSON válido, sin markdown, sin backticks.`;

function buildAnalisisPrompt(
  transcripcion: string,
  vacanteTitulo: string,
  empresaNombre: string,
  habilidadesRequeridas: string[]
): string {
  return `Analiza esta transcripción de entrevista para el cargo "${vacanteTitulo}" en "${empresaNombre}".

Habilidades requeridas: ${habilidadesRequeridas.join(', ') || 'No especificadas'}

TRANSCRIPCIÓN:
---
${transcripcion}
---

Evalúa al candidato en estas 5 dimensiones y devuelve este JSON exacto:

{
  "competencia_tecnica": {
    "score": <0-100>,
    "peso": 0.35,
    "ponderado": <score * 0.35>,
    "justificacion": "Explicación de por qué ese score",
    "evidencia": ["Cita textual 1 del candidato", "Cita textual 2"]
  },
  "motivacion": {
    "score": <0-100>,
    "peso": 0.20,
    "ponderado": <score * 0.20>,
    "justificacion": "...",
    "evidencia": ["..."]
  },
  "conexion_cultural": {
    "score": <0-100>,
    "peso": 0.20,
    "ponderado": <score * 0.20>,
    "justificacion": "...",
    "evidencia": ["..."]
  },
  "comunicacion": {
    "score": <0-100>,
    "peso": 0.15,
    "ponderado": <score * 0.15>,
    "justificacion": "...",
    "evidencia": ["..."]
  },
  "tono_emocional": {
    "score": <0-100>,
    "peso": 0.10,
    "ponderado": <score * 0.10>,
    "justificacion": "...",
    "evidencia": ["..."]
  },
  "resumen_general": "Resumen de 2-3 oraciones del desempeño del candidato",
  "fortalezas": ["Fortaleza 1", "Fortaleza 2", "Fortaleza 3"],
  "areas_mejora": ["Área 1", "Área 2"],
  "recomendacion": "avanzar | considerar | no_avanzar",
  "red_flags": ["Solo si hay señales de alerta serias, si no: lista vacía"]
}`;
}

export async function analizarTranscripcion(
  transcripcion: string,
  vacanteTitulo: string,
  empresaNombre: string,
  habilidadesRequeridas: string[]
): Promise<EntrevistaIAAnalisis> {
  const client = createAnthropicClient();

  if (!client) {
    return generarAnalisisFallback(transcripcion);
  }

  const prompt = buildAnalisisPrompt(transcripcion, vacanteTitulo, empresaNombre, habilidadesRequeridas);

  const responseText = await client.complete(
    ANALISIS_SYSTEM_PROMPT,
    [{ role: 'user', content: prompt }],
    { maxTokens: 4096, temperature: 0.1 }
  );

  const parsed = parseJsonResponse(responseText);
  return {
    ...parsed,
    analyzed_at: new Date().toISOString(),
  };
}

export function calcularScoreEntrevistaIA(analisis: EntrevistaIAAnalisis): number {
  return Math.round(
    (analisis.competencia_tecnica?.ponderado ?? 0) +
    (analisis.motivacion?.ponderado ?? 0) +
    (analisis.conexion_cultural?.ponderado ?? 0) +
    (analisis.comunicacion?.ponderado ?? 0) +
    (analisis.tono_emocional?.ponderado ?? 0)
  );
}

function generarAnalisisFallback(transcripcion: string): EntrevistaIAAnalisis {
  const longitud = transcripcion.length;
  const baseScore = longitud > 1000 ? 60 : longitud > 500 ? 45 : 30;

  const makeDimension = (score: number, peso: number) => ({
    score,
    peso,
    ponderado: Math.round(score * peso),
    justificacion: 'Análisis automático no disponible — se requiere ANTHROPIC_API_KEY para análisis detallado',
    evidencia: [] as string[],
  });

  return {
    competencia_tecnica: makeDimension(baseScore, 0.35),
    motivacion: makeDimension(baseScore, 0.20),
    conexion_cultural: makeDimension(baseScore, 0.20),
    comunicacion: makeDimension(baseScore, 0.15),
    tono_emocional: makeDimension(baseScore, 0.10),
    resumen_general: 'Análisis automatizado no disponible. Configure ANTHROPIC_API_KEY para análisis detallado con IA.',
    fortalezas: [],
    areas_mejora: [],
    recomendacion: 'considerar',
    red_flags: [],
    analyzed_at: new Date().toISOString(),
  };
}
