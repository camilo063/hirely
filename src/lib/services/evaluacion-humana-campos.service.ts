import { pool } from '@/lib/db';
import { cached, invalidate, cacheKeys } from '@/lib/cache';

/**
 * Campo de evaluacion humana configurable por organizacion.
 * Cada campo se califica de min_valor a max_valor (por defecto 1..5, con decimales).
 */
export interface Campo {
  id?: string;
  campo_key: string;
  label: string;
  descripcion?: string | null;
  orden: number;
  min_valor: number;
  max_valor: number;
  activo: boolean;
}

/**
 * Campos por defecto. Se devuelven cuando la organizacion aun no ha
 * personalizado sus criterios (sin insertarlos en DB).
 */
export const CAMPOS_EVALUACION_HUMANA_DEFAULT: Campo[] = [
  {
    campo_key: 'actitud',
    label: 'Actitud',
    descripcion: 'Disposición, energía y actitud general frente al trabajo.',
    orden: 1,
    min_valor: 1,
    max_valor: 5,
    activo: true,
  },
  {
    campo_key: 'liderazgo',
    label: 'Liderazgo',
    descripcion: 'Capacidad de guiar, influir y tomar iniciativa.',
    orden: 2,
    min_valor: 1,
    max_valor: 5,
    activo: true,
  },
  {
    campo_key: 'trabajo_equipo',
    label: 'Trabajo en equipo',
    descripcion: 'Colaboración y aporte dentro de un equipo.',
    orden: 3,
    min_valor: 1,
    max_valor: 5,
    activo: true,
  },
  {
    campo_key: 'cumplimiento',
    label: 'Cumplimiento',
    descripcion: 'Responsabilidad y cumplimiento de compromisos y plazos.',
    orden: 4,
    min_valor: 1,
    max_valor: 5,
    activo: true,
  },
  {
    campo_key: 'compromiso',
    label: 'Compromiso',
    descripcion: 'Nivel de compromiso e identificación con los objetivos.',
    orden: 5,
    min_valor: 1,
    max_valor: 5,
    activo: true,
  },
  {
    campo_key: 'aspiraciones',
    label: 'Aspiraciones',
    descripcion: 'Claridad de metas profesionales y ambición de crecimiento.',
    orden: 6,
    min_valor: 1,
    max_valor: 5,
    activo: true,
  },
  {
    campo_key: 'relacion_familiar',
    label: 'Relación Familiar',
    descripcion: 'Estabilidad y entorno familiar del candidato.',
    orden: 7,
    min_valor: 1,
    max_valor: 5,
    activo: true,
  },
];

function mapRow(row: {
  id: string;
  campo_key: string;
  label: string;
  descripcion: string | null;
  orden: number | null;
  min_valor: string | number | null;
  max_valor: string | number | null;
  activo: boolean;
}): Campo {
  return {
    id: row.id,
    campo_key: row.campo_key,
    label: row.label,
    descripcion: row.descripcion,
    orden: row.orden ?? 0,
    min_valor: row.min_valor != null ? Number(row.min_valor) : 1,
    max_valor: row.max_valor != null ? Number(row.max_valor) : 5,
    activo: row.activo,
  };
}

/**
 * Devuelve los campos de evaluacion humana de la organizacion.
 * Si la org aun no tiene filas propias, devuelve los DEFAULT (sin insertarlos).
 * Si tiene, devuelve solo los activos, ordenados por `orden`.
 */
export async function getCamposEvaluacion(orgId: string): Promise<Campo[]> {
  return cached(cacheKeys.evaluacionCampos(orgId), async () => {
    // Siembra los 7 campos por defecto la primera vez, para que aparezcan como
    // filas reales (con id) editables/reordenables/eliminables, no como texto fijo.
    await seedCamposSiVacio(orgId);

    const { rows } = await pool.query(
      `SELECT id, campo_key, label, descripcion, orden, min_valor, max_valor, activo
       FROM evaluacion_humana_campos
       WHERE organization_id = $1
       ORDER BY orden ASC, created_at ASC`,
      [orgId]
    );

    return rows.filter((r) => r.activo).map(mapRow);
  });
}

/**
 * Inserta los campos por defecto para la organizacion si aun no tiene ninguno.
 * Idempotente: no hace nada si ya existen filas.
 */
export async function seedCamposSiVacio(orgId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT 1 FROM evaluacion_humana_campos WHERE organization_id = $1 LIMIT 1`,
    [orgId]
  );
  if (rows.length > 0) return;

  for (const c of CAMPOS_EVALUACION_HUMANA_DEFAULT) {
    await pool.query(
      `INSERT INTO evaluacion_humana_campos
         (organization_id, campo_key, label, descripcion, orden, min_valor, max_valor, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (organization_id, campo_key) DO NOTHING`,
      [orgId, c.campo_key, c.label, c.descripcion ?? null, c.orden, c.min_valor, c.max_valor, c.activo]
    );
  }
}

function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || `campo_${Date.now()}`;
}

export interface CrearCampoInput {
  campo_key?: string;
  label: string;
  descripcion?: string | null;
  orden?: number;
  min_valor?: number;
  max_valor?: number;
  activo?: boolean;
}

/**
 * Crea un campo para la organizacion. Si la org aun usaba los defaults
 * (sin filas propias), primero los persiste para no perderlos.
 */
export async function crearCampo(orgId: string, data: CrearCampoInput): Promise<Campo> {
  await seedCamposSiVacio(orgId);

  const label = (data.label || '').trim() || 'Nuevo campo';
  let campoKey = (data.campo_key || '').trim() || slugifyKey(label);

  // Evitar colision de campo_key dentro de la org
  const existing = await pool.query(
    `SELECT campo_key FROM evaluacion_humana_campos WHERE organization_id = $1`,
    [orgId]
  );
  const keys = new Set(existing.rows.map((r: { campo_key: string }) => r.campo_key));
  if (keys.has(campoKey)) {
    let i = 2;
    while (keys.has(`${campoKey}_${i}`)) i++;
    campoKey = `${campoKey}_${i}`.slice(0, 60);
  }

  let orden = data.orden;
  if (orden == null) {
    const { rows } = await pool.query(
      `SELECT COALESCE(MAX(orden), 0) + 1 AS next FROM evaluacion_humana_campos WHERE organization_id = $1`,
      [orgId]
    );
    orden = Number(rows[0]?.next ?? 1);
  }

  const { rows } = await pool.query(
    `INSERT INTO evaluacion_humana_campos
       (organization_id, campo_key, label, descripcion, orden, min_valor, max_valor, activo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, campo_key, label, descripcion, orden, min_valor, max_valor, activo`,
    [
      orgId,
      campoKey,
      label,
      data.descripcion ?? null,
      orden,
      data.min_valor ?? 1,
      data.max_valor ?? 5,
      data.activo ?? true,
    ]
  );

  await invalidate(cacheKeys.evaluacionCampos(orgId));
  return mapRow(rows[0]);
}

export interface ActualizarCampoInput {
  label?: string;
  descripcion?: string | null;
  orden?: number;
  min_valor?: number;
  max_valor?: number;
  activo?: boolean;
}

export async function actualizarCampo(
  orgId: string,
  campoId: string,
  data: ActualizarCampoInput
): Promise<Campo | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const setField = (col: string, value: unknown) => {
    updates.push(`${col} = $${idx}`);
    values.push(value);
    idx++;
  };

  if (data.label !== undefined) setField('label', data.label);
  if (data.descripcion !== undefined) setField('descripcion', data.descripcion);
  if (data.orden !== undefined) setField('orden', data.orden);
  if (data.min_valor !== undefined) setField('min_valor', data.min_valor);
  if (data.max_valor !== undefined) setField('max_valor', data.max_valor);
  if (data.activo !== undefined) setField('activo', data.activo);

  if (updates.length === 0) {
    const { rows } = await pool.query(
      `SELECT id, campo_key, label, descripcion, orden, min_valor, max_valor, activo
       FROM evaluacion_humana_campos WHERE id = $1 AND organization_id = $2`,
      [campoId, orgId]
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  updates.push(`updated_at = NOW()`);
  values.push(campoId, orgId);

  const { rows } = await pool.query(
    `UPDATE evaluacion_humana_campos
     SET ${updates.join(', ')}
     WHERE id = $${idx} AND organization_id = $${idx + 1}
     RETURNING id, campo_key, label, descripcion, orden, min_valor, max_valor, activo`,
    values
  );

  await invalidate(cacheKeys.evaluacionCampos(orgId));
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function eliminarCampo(orgId: string, campoId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM evaluacion_humana_campos WHERE id = $1 AND organization_id = $2`,
    [campoId, orgId]
  );
  await invalidate(cacheKeys.evaluacionCampos(orgId));
  return (rowCount ?? 0) > 0;
}

/**
 * Guarda la evaluacion humana de una aplicacion, calcula score_humano (0-100)
 * normalizando cada valor por su rango (min/max), y recalcula score_final.
 */
export async function guardarEvaluacionHumana(
  orgId: string,
  aplicacionId: string,
  valores: Record<string, number>,
  observaciones?: string
): Promise<{ score_humano: number }> {
  const campos = await getCamposEvaluacion(orgId);

  const normalizados: number[] = [];
  for (const campo of campos) {
    const raw = valores[campo.campo_key];
    if (raw == null || Number.isNaN(Number(raw))) continue;
    const min = campo.min_valor;
    const max = campo.max_valor;
    const span = max - min;
    if (span <= 0) continue;
    let norm = (Number(raw) - min) / span; // 0..1
    if (norm < 0) norm = 0;
    if (norm > 1) norm = 1;
    normalizados.push(norm);
  }

  const promedio = normalizados.length > 0
    ? normalizados.reduce((a, b) => a + b, 0) / normalizados.length
    : 0;
  const scoreHumano = Math.round(promedio * 100 * 100) / 100; // 0-100, 2 decimales

  const jsonb = {
    valores,
    observaciones: observaciones || null,
    evaluated_at: new Date().toISOString(),
  };

  await pool.query(
    `UPDATE aplicaciones
     SET evaluacion_humana = $1, score_humano = $2, updated_at = NOW()
     WHERE id = $3 AND organization_id = $4`,
    [JSON.stringify(jsonb), scoreHumano, aplicacionId, orgId]
  );

  const { recalcularScoreFinal } = await import('./scoring-dual.service');
  await recalcularScoreFinal(aplicacionId);

  return { score_humano: scoreHumano };
}
