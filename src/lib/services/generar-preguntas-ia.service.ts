import { AnthropicClient } from '@/lib/integrations/anthropic.client';
import { z } from 'zod';

const preguntaGeneradaSchema = z.object({
  enunciado: z.string().min(1),
  tipo: z.enum(['opcion_multiple', 'verdadero_falso', 'respuesta_abierta', 'codigo']),
  opciones: z.array(z.object({
    id: z.string(),
    texto: z.string(),
    es_correcta: z.boolean(),
  })).nullable().optional(),
  respuesta_correcta: z.string().nullable().optional(),
  explicacion: z.string().nullable().optional(),
  puntos: z.number(),
  dificultad: z.string(),
  categoria: z.string(),
  subcategoria: z.string().nullable().optional(),
  tiempo_estimado_segundos: z.number(),
  tags: z.array(z.string()),
});

const responseSchema = z.object({
  preguntas: z.array(preguntaGeneradaSchema),
});

export interface GenerarPreguntasConfig {
  categoria: string;
  subcategoria?: string;
  tipos: Array<'opcion_multiple' | 'verdadero_falso' | 'respuesta_abierta' | 'codigo'>;
  dificultad: 'basico' | 'intermedio' | 'avanzado' | 'experto';
  cantidad: number;
  puntos_por_pregunta: number;
  cargo_objetivo?: string;
  idioma: 'es' | 'en';
  instrucciones_adicionales?: string;
}

export interface PreguntaGenerada {
  enunciado: string;
  tipo: string;
  opciones?: Array<{ id: string; texto: string; es_correcta: boolean }> | null;
  respuesta_correcta?: string | null;
  explicacion?: string | null;
  puntos: number;
  dificultad: string;
  categoria: string;
  subcategoria?: string | null;
  tiempo_estimado_segundos: number;
  tags: string[];
}

const SYSTEM_PROMPT = `Eres un experto en reclutamiento técnico y diseño de evaluaciones para candidatos de tecnología.
Tu tarea es generar preguntas de evaluación técnica de alta calidad para un proceso de selección.
Las preguntas deben ser precisas, sin ambigüedades, y evaluar competencias reales del cargo.
Responde ÚNICAMENTE con un JSON válido. Sin texto adicional, sin markdown, sin backticks.
El JSON debe tener exactamente esta estructura:
{
  "preguntas": [
    {
      "enunciado": "...",
      "tipo": "opcion_multiple|verdadero_falso|respuesta_abierta|codigo",
      "opciones": [{"id": "a", "texto": "...", "es_correcta": true}],
      "respuesta_correcta": "...",
      "explicacion": "...",
      "puntos": 10,
      "dificultad": "basico|intermedio|avanzado|experto",
      "categoria": "...",
      "subcategoria": "...",
      "tiempo_estimado_segundos": 120,
      "tags": ["tag1", "tag2"]
    }
  ]
}`;

function buildUserPrompt(config: GenerarPreguntasConfig): string {
  const idiomaTxt = config.idioma === 'es' ? 'Español' : 'English';
  let prompt = `Genera ${config.cantidad} pregunta(s) de evaluación técnica con estas especificaciones:
- Categoría: ${config.categoria}
- Subcategoría: ${config.subcategoria ?? 'No especificada'}
- Tipo(s) de pregunta: ${config.tipos.join(', ')}
- Dificultad: ${config.dificultad}
- Cargo objetivo: ${config.cargo_objetivo ?? 'Desarrollador de software'}
- Puntos por pregunta: ${config.puntos_por_pregunta}
- Idioma: ${idiomaTxt}`;

  if (config.instrucciones_adicionales) {
    prompt += `\n- Instrucciones adicionales: ${config.instrucciones_adicionales}`;
  }

  prompt += `

Para preguntas de opción múltiple: incluye 4 opciones, exactamente 1 correcta.
Para verdadero/falso: el enunciado debe ser una afirmación clara.
Para respuesta abierta o código: incluye en respuesta_correcta una guía de evaluación detallada.
Las preguntas deben ser originales, representativas del nivel de dificultad solicitado, y relevantes para el cargo.`;

  return prompt;
}

function parseAndValidate(text: string): PreguntaGenerada[] {
  // Clean potential markdown wrapping
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(cleaned);
  const result = responseSchema.parse(parsed);
  return result.preguntas;
}

export async function generarPreguntasConIA(config: GenerarPreguntasConfig): Promise<PreguntaGenerada[]> {
  const client = new AnthropicClient();
  if (!client.isConfigured()) {
    throw new Error('ANTHROPIC_API_KEY no configurada');
  }

  const userPrompt = buildUserPrompt(config);
  const maxTokens = Math.min(config.cantidad * 800, 8192);

  // First attempt
  try {
    const response = await client.complete(SYSTEM_PROMPT, [
      { role: 'user', content: userPrompt },
    ], { maxTokens, temperature: 0.7 });

    return parseAndValidate(response);
  } catch (firstError) {
    // Retry once with stricter prompt
    try {
      const strictPrompt = userPrompt + '\n\nIMPORTANTE: Responde SOLO con JSON válido. Sin texto antes ni después del JSON. Sin backticks.';
      const response = await client.complete(SYSTEM_PROMPT, [
        { role: 'user', content: strictPrompt },
      ], { maxTokens, temperature: 0.5 });

      return parseAndValidate(response);
    } catch {
      throw new Error('No se pudo generar preguntas. Intenta de nuevo.');
    }
  }
}
