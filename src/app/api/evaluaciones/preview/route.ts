import { NextRequest } from 'next/server';
import { getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';
import { z } from 'zod';

const previewSchema = z.object({
  estructura: z.array(z.object({
    categoria: z.string().min(1),
    cantidad: z.number().int().min(1).max(50),
    dificultad: z.enum(['basico', 'intermedio', 'avanzado', 'experto', 'mixta']),
    puntos_por_pregunta: z.number().int().min(1),
  })).min(1),
});

interface PreguntaPreview {
  pregunta_id: string;
  enunciado: string;
  tipo: string;
  opciones: Array<{ id: string; texto: string; es_correcta: boolean }> | null;
  respuesta_correcta: string | null;
  explicacion: string | null;
  puntos: number;
  orden: number;
  categoria: string;
  dificultad: string;
  tiempo_estimado_segundos: number;
}

async function seleccionarPreguntasPreview(
  orgId: string,
  estructura: z.infer<typeof previewSchema>['estructura']
): Promise<PreguntaPreview[]> {
  const preguntas: PreguntaPreview[] = [];
  let orden = 1;

  for (const item of estructura) {
    let query: string;
    let params: unknown[];

    if (item.dificultad === 'mixta') {
      query = `SELECT * FROM preguntas_banco
               WHERE organization_id = $1 AND categoria = $2 AND estado = 'activa'
               ORDER BY RANDOM() LIMIT $3`;
      params = [orgId, item.categoria, item.cantidad];
    } else {
      query = `SELECT * FROM preguntas_banco
               WHERE organization_id = $1 AND categoria = $2 AND dificultad = $3 AND estado = 'activa'
               ORDER BY RANDOM() LIMIT $4`;
      params = [orgId, item.categoria, item.dificultad, item.cantidad];
    }

    let result = await pool.query(query, params);

    if (result.rows.length < item.cantidad && item.dificultad !== 'mixta') {
      const remaining = item.cantidad - result.rows.length;
      const existingIds = result.rows.map((r: { id: string }) => r.id);
      const fallbackResult = await pool.query(
        `SELECT * FROM preguntas_banco
         WHERE organization_id = $1 AND categoria = $2 AND estado = 'activa'
         ${existingIds.length > 0 ? `AND id NOT IN (${existingIds.map((_: string, i: number) => `$${i + 3}`).join(',')})` : ''}
         ORDER BY RANDOM() LIMIT $${existingIds.length + 3}`,
        [orgId, item.categoria, ...existingIds, remaining]
      );
      result.rows = [...result.rows, ...fallbackResult.rows];
    }

    for (const row of result.rows) {
      const opciones = row.opciones
        ? (typeof row.opciones === 'string' ? JSON.parse(row.opciones) : row.opciones)
        : null;

      preguntas.push({
        pregunta_id: row.id,
        enunciado: row.enunciado,
        tipo: row.tipo,
        opciones,
        respuesta_correcta: row.respuesta_correcta || null,
        explicacion: row.explicacion || null,
        puntos: item.puntos_por_pregunta,
        orden: orden++,
        categoria: row.categoria,
        dificultad: row.dificultad,
        tiempo_estimado_segundos: row.tiempo_estimado_segundos,
      });
    }
  }

  return preguntas;
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const body = await request.json();
    const { estructura } = previewSchema.parse(body);

    const preguntas = await seleccionarPreguntasPreview(orgId, estructura);
    return apiResponse({ preguntas });
  } catch (error) {
    return apiError(error);
  }
}
