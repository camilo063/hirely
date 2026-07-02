import { pool } from '@/lib/db';
import { PIPELINE_STATES_CONFIG, PipelineState } from '@/lib/constants/pipeline-states';

/**
 * Devuelve el catalogo de estados del pipeline para una organizacion.
 *
 * Parte del catalogo fijo (PIPELINE_STATES_CONFIG) y aplica los overrides que
 * la organizacion haya guardado en pipeline_estados_config: label, orden y
 * activo. El resto de campos (key, color, automatico, prerequisitos,
 * descripcion) siempre provienen del default. Los overrides NO agregan ni
 * quitan estados: se devuelven TODOS los del catalogo, ordenados por `orden`.
 */
export async function getPipelineEstadosConfig(orgId: string): Promise<PipelineState[]> {
  const result = await pool.query(
    `SELECT estado_key, label, orden, activo
     FROM pipeline_estados_config
     WHERE organization_id = $1`,
    [orgId]
  );

  const overrides = new Map<
    string,
    { label: string | null; orden: number | null; activo: boolean | null }
  >();
  for (const row of result.rows) {
    overrides.set(row.estado_key, {
      label: row.label,
      orden: row.orden,
      activo: row.activo,
    });
  }

  const merged: PipelineState[] = PIPELINE_STATES_CONFIG.map((def) => {
    const ov = overrides.get(def.key);
    if (!ov) return { ...def };
    return {
      ...def,
      label: ov.label ?? def.label,
      orden: ov.orden ?? def.orden,
      activo: ov.activo ?? def.activo ?? true,
    };
  });

  merged.sort((a, b) => a.orden - b.orden);
  return merged;
}

/**
 * Upsert de overrides de estados del pipeline para una organizacion.
 * Solo procesa estado_key que existan en el catalogo fijo (ignora desconocidos).
 */
export async function updatePipelineEstadosConfig(
  orgId: string,
  estados: { estado_key: string; label?: string; orden?: number; activo?: boolean }[]
): Promise<void> {
  const validKeys = new Set(PIPELINE_STATES_CONFIG.map((s) => s.key));
  const validos = estados.filter((e) => validKeys.has(e.estado_key));

  for (const estado of validos) {
    await pool.query(
      `INSERT INTO pipeline_estados_config
         (organization_id, estado_key, label, orden, activo)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (organization_id, estado_key) DO UPDATE SET
         label = EXCLUDED.label,
         orden = EXCLUDED.orden,
         activo = EXCLUDED.activo,
         updated_at = NOW()`,
      [
        orgId,
        estado.estado_key,
        estado.label ?? null,
        estado.orden ?? null,
        estado.activo ?? true,
      ]
    );
  }
}
