import { pool } from '../db';
import { UUID, PaginationParams } from '../types/common.types';
import { Vacante, VacanteWithStats, CreateVacanteInput, UpdateVacanteInput, VacanteFilters } from '../types/vacante.types';
import { NotFoundError } from '../utils/errors';

export async function listVacantes(
  orgId: UUID,
  filters: VacanteFilters = {},
  pagination: PaginationParams = { page: 1, limit: 20 }
) {
  const conditions = ['v.organization_id = $1'];
  const params: unknown[] = [orgId];
  let paramIndex = 2;

  if (filters.estado) {
    conditions.push(`v.estado = $${paramIndex++}`);
    params.push(filters.estado);
  }
  if (filters.departamento) {
    conditions.push(`v.departamento = $${paramIndex++}`);
    params.push(filters.departamento);
  }
  if (filters.search) {
    conditions.push(`(v.titulo ILIKE $${paramIndex} OR v.descripcion ILIKE $${paramIndex})`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  const where = conditions.join(' AND ');
  const offset = (pagination.page - 1) * pagination.limit;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM vacantes v WHERE ${where}`,
    params
  );

  params.push(pagination.limit, offset);
  const result = await pool.query<VacanteWithStats>(
    `SELECT v.*,
      COALESCE(stats.total, 0)::int as total_aplicaciones,
      COALESCE(stats.nuevos, 0)::int as nuevos,
      COALESCE(stats.en_proceso, 0)::int as en_proceso,
      COALESCE(stats.seleccionados, 0)::int as seleccionados
    FROM vacantes v
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE a.estado = 'nuevo') as nuevos,
        COUNT(*) FILTER (WHERE a.estado NOT IN ('nuevo', 'descartado', 'contratado')) as en_proceso,
        COUNT(*) FILTER (WHERE a.estado = 'seleccionado') as seleccionados
      FROM aplicaciones a WHERE a.vacante_id = v.id
    ) stats ON true
    WHERE ${where}
    ORDER BY v.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    params
  );

  return {
    data: result.rows,
    total: parseInt(countResult.rows[0].count),
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(parseInt(countResult.rows[0].count) / pagination.limit),
  };
}

export async function getVacante(orgId: UUID, vacanteId: UUID): Promise<VacanteWithStats> {
  const result = await pool.query<VacanteWithStats>(
    `SELECT v.*,
      COALESCE(stats.total, 0)::int as total_aplicaciones,
      COALESCE(stats.nuevos, 0)::int as nuevos,
      COALESCE(stats.en_proceso, 0)::int as en_proceso,
      COALESCE(stats.seleccionados, 0)::int as seleccionados
    FROM vacantes v
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE a.estado = 'nuevo') as nuevos,
        COUNT(*) FILTER (WHERE a.estado NOT IN ('nuevo', 'descartado', 'contratado')) as en_proceso,
        COUNT(*) FILTER (WHERE a.estado = 'seleccionado') as seleccionados
      FROM aplicaciones a WHERE a.vacante_id = v.id
    ) stats ON true
    WHERE v.id = $1 AND v.organization_id = $2`,
    [vacanteId, orgId]
  );

  if (result.rows.length === 0) throw new NotFoundError('Vacante', vacanteId);
  return result.rows[0];
}

export async function createVacante(
  orgId: UUID,
  userId: UUID,
  input: CreateVacanteInput
): Promise<Vacante> {
  const result = await pool.query<Vacante>(
    `INSERT INTO vacantes (organization_id, titulo, descripcion, departamento, ubicacion,
      tipo_contrato, modalidad, rango_salarial_min, rango_salarial_max, moneda, criterios_evaluacion,
      habilidades_requeridas, experiencia_minima, score_minimo, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
    [
      orgId, input.titulo, input.descripcion, input.departamento, input.ubicacion,
      input.tipo_contrato, input.modalidad ?? 'remoto',
      input.rango_salarial_min ?? null, input.rango_salarial_max ?? null,
      input.moneda ?? 'COP', JSON.stringify(input.criterios_evaluacion),
      JSON.stringify(input.habilidades_requeridas), input.experiencia_minima,
      input.score_minimo ?? 70, userId,
    ]
  );
  return result.rows[0];
}

export async function updateVacante(
  orgId: UUID,
  vacanteId: UUID,
  input: UpdateVacanteInput
): Promise<Vacante> {
  const fields: string[] = [];
  const params: unknown[] = [vacanteId, orgId];
  let paramIndex = 3;

  const fieldMap: Record<string, unknown> = { ...input };
  if (input.criterios_evaluacion) fieldMap.criterios_evaluacion = JSON.stringify(input.criterios_evaluacion);
  if (input.habilidades_requeridas) fieldMap.habilidades_requeridas = JSON.stringify(input.habilidades_requeridas);

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`);
      params.push(value);
    }
  }

  if (fields.length === 0) {
    return getVacante(orgId, vacanteId);
  }

  fields.push('updated_at = NOW()');

  const result = await pool.query<Vacante>(
    `UPDATE vacantes SET ${fields.join(', ')} WHERE id = $1 AND organization_id = $2 RETURNING *`,
    params
  );

  if (result.rows.length === 0) throw new NotFoundError('Vacante', vacanteId);
  return result.rows[0];
}

export async function deleteVacante(orgId: UUID, vacanteId: UUID): Promise<void> {
  const result = await pool.query(
    'DELETE FROM vacantes WHERE id = $1 AND organization_id = $2',
    [vacanteId, orgId]
  );
  if (result.rowCount === 0) throw new NotFoundError('Vacante', vacanteId);
}

export async function getDashboardStats(orgId: UUID) {
  const result = await pool.query(
    `SELECT
      (SELECT COUNT(*) FROM vacantes WHERE organization_id = $1 AND estado = 'publicada')::int as vacantes_activas,
      (SELECT COUNT(*) FROM candidatos WHERE organization_id = $1)::int as total_candidatos,
      (SELECT COUNT(*) FROM aplicaciones a JOIN vacantes v ON a.vacante_id = v.id WHERE v.organization_id = $1 AND a.estado NOT IN ('descartado', 'contratado'))::int as en_proceso,
      (SELECT COUNT(*) FROM aplicaciones a JOIN vacantes v ON a.vacante_id = v.id WHERE v.organization_id = $1 AND a.estado = 'contratado')::int as contratados,
      (SELECT COUNT(*) FROM entrevistas_ia ei JOIN aplicaciones a ON ei.aplicacion_id = a.id JOIN vacantes v ON a.vacante_id = v.id WHERE v.organization_id = $1 AND ei.estado = 'pendiente')::int as entrevistas_pendientes`,
    [orgId]
  );
  return result.rows[0];
}
