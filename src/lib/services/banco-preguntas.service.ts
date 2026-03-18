import { pool } from '@/lib/db';
import type {
  PreguntaBanco,
  PreguntaAsignada,
  EstructuraPlantilla,
  PreguntaFiltros,
  CategoriaConteo,
  Dificultad,
} from '@/lib/types/evaluacion-tecnica.types';

/**
 * CRUD completo del banco de preguntas + selección inteligente.
 */

export async function listarPreguntas(filtros: PreguntaFiltros): Promise<{ preguntas: PreguntaBanco[]; total: number }> {
  const conditions: string[] = ['pb.organization_id = $1'];
  const params: unknown[] = [filtros.organization_id];
  let idx = 2;

  if (filtros.categoria) {
    conditions.push(`pb.categoria = $${idx++}`);
    params.push(filtros.categoria);
  }
  if (filtros.dificultad) {
    conditions.push(`pb.dificultad = $${idx++}`);
    params.push(filtros.dificultad);
  }
  if (filtros.tipo) {
    conditions.push(`pb.tipo = $${idx++}`);
    params.push(filtros.tipo);
  }
  if (filtros.estado) {
    conditions.push(`pb.estado = $${idx++}`);
    params.push(filtros.estado);
  } else {
    conditions.push(`pb.estado != 'archivada'`);
  }
  if (filtros.es_estandar !== undefined) {
    conditions.push(`pb.es_estandar = $${idx++}`);
    params.push(filtros.es_estandar);
  }
  if (filtros.busqueda) {
    conditions.push(`pb.enunciado ILIKE $${idx++}`);
    params.push(`%${filtros.busqueda}%`);
  }
  if (filtros.tags && filtros.tags.length > 0) {
    conditions.push(`pb.tags && $${idx++}`);
    params.push(filtros.tags);
  }
  if (filtros.cargo) {
    conditions.push(`(pb.es_estandar = true OR $${idx++} = ANY(pb.cargos_aplicables))`);
    params.push(filtros.cargo);
  }

  const where = conditions.join(' AND ');
  const limit = filtros.limit || 50;
  const offset = ((filtros.page || 1) - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT pb.* FROM preguntas_banco pb WHERE ${where}
       ORDER BY pb.categoria, pb.dificultad, pb.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*)::int as total FROM preguntas_banco pb WHERE ${where}`,
      params
    ),
  ]);

  return {
    preguntas: dataResult.rows,
    total: countResult.rows[0].total,
  };
}

export async function obtenerPregunta(id: string, orgId: string): Promise<PreguntaBanco | null> {
  const result = await pool.query(
    'SELECT * FROM preguntas_banco WHERE id = $1 AND organization_id = $2',
    [id, orgId]
  );
  return result.rows[0] || null;
}

export async function crearPregunta(orgId: string, data: Partial<PreguntaBanco>, creadoPor: string): Promise<PreguntaBanco> {
  const result = await pool.query(
    `INSERT INTO preguntas_banco (
      organization_id, categoria, subcategoria, tipo, dificultad,
      enunciado, opciones, respuesta_correcta, explicacion,
      puntos, tiempo_estimado_segundos, tags, es_estandar,
      cargos_aplicables, idioma, estado, creado_por
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING *`,
    [
      orgId, data.categoria, data.subcategoria || null, data.tipo, data.dificultad,
      data.enunciado, data.opciones ? JSON.stringify(data.opciones) : null,
      data.respuesta_correcta || null, data.explicacion || null,
      data.puntos || 10, data.tiempo_estimado_segundos || 120,
      data.tags || [], data.es_estandar || false,
      data.cargos_aplicables || [], data.idioma || 'es',
      data.estado || 'activa', creadoPor,
    ]
  );
  return result.rows[0];
}

export async function actualizarPregunta(id: string, orgId: string, data: Partial<PreguntaBanco>): Promise<PreguntaBanco> {
  const fields: string[] = [];
  const params: unknown[] = [id, orgId];
  let idx = 3;

  const allowedFields: Record<string, (v: unknown) => unknown> = {
    categoria: (v) => v,
    subcategoria: (v) => v,
    tipo: (v) => v,
    dificultad: (v) => v,
    enunciado: (v) => v,
    opciones: (v) => v ? JSON.stringify(v) : null,
    respuesta_correcta: (v) => v,
    explicacion: (v) => v,
    puntos: (v) => v,
    tiempo_estimado_segundos: (v) => v,
    tags: (v) => v,
    es_estandar: (v) => v,
    cargos_aplicables: (v) => v,
    idioma: (v) => v,
    estado: (v) => v,
  };

  for (const [key, transform] of Object.entries(allowedFields)) {
    if ((data as Record<string, unknown>)[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      params.push(transform((data as Record<string, unknown>)[key]));
    }
  }

  if (fields.length === 0) {
    const existing = await obtenerPregunta(id, orgId);
    if (!existing) throw new Error('Pregunta no encontrada');
    return existing;
  }

  fields.push('updated_at = NOW()');

  const result = await pool.query(
    `UPDATE preguntas_banco SET ${fields.join(', ')}
     WHERE id = $1 AND organization_id = $2 RETURNING *`,
    params
  );
  if (result.rows.length === 0) throw new Error('Pregunta no encontrada');
  return result.rows[0];
}

export async function obtenerCategorias(orgId: string): Promise<CategoriaConteo[]> {
  const result = await pool.query(
    `SELECT
       categoria,
       COUNT(*)::int as total,
       COUNT(*) FILTER (WHERE dificultad = 'basico')::int as basico,
       COUNT(*) FILTER (WHERE dificultad = 'intermedio')::int as intermedio,
       COUNT(*) FILTER (WHERE dificultad = 'avanzado')::int as avanzado,
       COUNT(*) FILTER (WHERE dificultad = 'experto')::int as experto
     FROM preguntas_banco
     WHERE organization_id = $1 AND estado = 'activa'
     GROUP BY categoria
     ORDER BY total DESC`,
    [orgId]
  );

  return result.rows.map(r => ({
    categoria: r.categoria,
    total: r.total,
    por_dificultad: {
      basico: r.basico,
      intermedio: r.intermedio,
      avanzado: r.avanzado,
      experto: r.experto,
    },
  }));
}

export async function importarPreguntas(
  orgId: string,
  preguntas: Partial<PreguntaBanco>[],
  creadoPor: string
): Promise<{ importadas: number; errores: string[] }> {
  let importadas = 0;
  const errores: string[] = [];

  for (let i = 0; i < preguntas.length; i++) {
    try {
      await crearPregunta(orgId, preguntas[i], creadoPor);
      importadas++;
    } catch (err) {
      errores.push(`Pregunta ${i + 1}: ${(err as Error).message}`);
    }
  }

  return { importadas, errores };
}

/**
 * Selección inteligente de preguntas del banco.
 * Si no hay suficientes de una dificultad, ajusta a mixta.
 */
export async function seleccionarPreguntas(
  orgId: string,
  estructura: EstructuraPlantilla[]
): Promise<PreguntaAsignada[]> {
  const preguntas: PreguntaAsignada[] = [];
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

    // Fallback: if not enough at specified difficulty, try any difficulty
    if (result.rows.length < item.cantidad && item.dificultad !== 'mixta') {
      const remaining = item.cantidad - result.rows.length;
      const existingIds = result.rows.map((r: PreguntaBanco) => r.id);
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
      // Strip correct answers from options for candidate view
      const opciones = row.opciones
        ? (typeof row.opciones === 'string' ? JSON.parse(row.opciones) : row.opciones)
            .map((o: { id: string; texto: string }) => ({ id: o.id, texto: o.texto, es_correcta: false }))
        : null;

      preguntas.push({
        pregunta_id: row.id,
        enunciado: row.enunciado,
        tipo: row.tipo,
        opciones,
        puntos: item.puntos_por_pregunta,
        orden: orden++,
        categoria: row.categoria,
        dificultad: row.dificultad,
      });
    }
  }

  return preguntas;
}

/**
 * Get questions with correct answers for scoring.
 */
export async function obtenerPreguntasConRespuestas(preguntaIds: string[]): Promise<Map<string, PreguntaBanco>> {
  if (preguntaIds.length === 0) return new Map();

  const placeholders = preguntaIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await pool.query(
    `SELECT * FROM preguntas_banco WHERE id IN (${placeholders})`,
    preguntaIds
  );

  const map = new Map<string, PreguntaBanco>();
  for (const row of result.rows) {
    map.set(row.id, row);
  }
  return map;
}
