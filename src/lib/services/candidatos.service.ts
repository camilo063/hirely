import { pool } from '../db';
import { UUID, PaginationParams } from '../types/common.types';
import {
  Candidato, CandidatoEnriquecido, Aplicacion, AplicacionConCandidato,
  CreateCandidatoInput, CreateAplicacionInput, CandidatoFilters,
} from '../types/candidato.types';
import { NotFoundError } from '../utils/errors';

export async function listCandidatos(
  orgId: UUID,
  filters: CandidatoFilters = {},
  pagination: PaginationParams = { page: 1, limit: 20 }
) {
  const conditions = ['c.organization_id = $1'];
  const params: unknown[] = [orgId];
  let paramIndex = 2;

  if (filters.search) {
    conditions.push(`(c.nombre ILIKE $${paramIndex} OR c.apellido ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(c.habilidades) h WHERE h ILIKE $${paramIndex}))`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }
  if (filters.habilidad) {
    conditions.push(`c.habilidades @> $${paramIndex}::jsonb`);
    params.push(JSON.stringify([filters.habilidad]));
    paramIndex++;
  }
  if (filters.fuente) {
    conditions.push(`c.fuente = $${paramIndex}`);
    params.push(filters.fuente);
    paramIndex++;
  }
  if (filters.vacanteId) {
    conditions.push(`EXISTS (SELECT 1 FROM aplicaciones a2 WHERE a2.candidato_id = c.id AND a2.vacante_id = $${paramIndex})`);
    params.push(filters.vacanteId);
    paramIndex++;
  }
  if (filters.estado && filters.estado.length > 0) {
    conditions.push(`EXISTS (SELECT 1 FROM aplicaciones a3 WHERE a3.candidato_id = c.id AND a3.estado = ANY($${paramIndex}::text[]))`);
    params.push(filters.estado);
    paramIndex++;
  }
  if (filters.scoreRange) {
    switch (filters.scoreRange) {
      case 'excelente':
        conditions.push(`EXISTS (SELECT 1 FROM aplicaciones a4 WHERE a4.candidato_id = c.id AND a4.score_ats >= 85)`);
        break;
      case 'bueno':
        conditions.push(`EXISTS (SELECT 1 FROM aplicaciones a4 WHERE a4.candidato_id = c.id AND a4.score_ats >= 70 AND a4.score_ats < 85)`);
        break;
      case 'regular':
        conditions.push(`EXISTS (SELECT 1 FROM aplicaciones a4 WHERE a4.candidato_id = c.id AND a4.score_ats >= 50 AND a4.score_ats < 70)`);
        break;
      case 'bajo':
        conditions.push(`EXISTS (SELECT 1 FROM aplicaciones a4 WHERE a4.candidato_id = c.id AND a4.score_ats IS NOT NULL AND a4.score_ats < 50)`);
        break;
      case 'sin_score':
        conditions.push(`NOT EXISTS (SELECT 1 FROM aplicaciones a4 WHERE a4.candidato_id = c.id AND a4.score_ats IS NOT NULL)`);
        break;
    }
  }

  const where = conditions.join(' AND ');
  const offset = (pagination.page - 1) * pagination.limit;

  const countResult = await pool.query(`SELECT COUNT(*) FROM candidatos c WHERE ${where}`, params);

  const limitIdx = paramIndex++;
  const offsetIdx = paramIndex;
  params.push(pagination.limit, offset);

  const result = await pool.query<CandidatoEnriquecido>(
    `SELECT c.*,
      (
        SELECT json_agg(json_build_object(
          'id', v.id,
          'titulo', v.titulo,
          'estado', a.estado,
          'score_ats', a.score_ats
        ) ORDER BY a.created_at DESC)
        FROM aplicaciones a
        JOIN vacantes v ON v.id = a.vacante_id
        WHERE a.candidato_id = c.id
      ) as vacantes,
      (SELECT MAX(a.score_ats) FROM aplicaciones a WHERE a.candidato_id = c.id) as max_score,
      (
        SELECT a.estado FROM aplicaciones a WHERE a.candidato_id = c.id
        ORDER BY CASE a.estado
          WHEN 'contratado' THEN 8
          WHEN 'seleccionado' THEN 7
          WHEN 'entrevista_humana' THEN 6
          WHEN 'entrevista_ia' THEN 5
          WHEN 'preseleccionado' THEN 4
          WHEN 'revisado' THEN 3
          WHEN 'nuevo' THEN 2
          WHEN 'descartado' THEN 1
        END DESC
        LIMIT 1
      ) as estado_mas_avanzado
    FROM candidatos c
    WHERE ${where}
    ORDER BY c.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
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

export async function getCandidato(orgId: UUID, candidatoId: UUID): Promise<Candidato> {
  const result = await pool.query<Candidato>(
    'SELECT * FROM candidatos WHERE id = $1 AND organization_id = $2',
    [candidatoId, orgId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Candidato', candidatoId);
  return result.rows[0];
}

export async function createCandidato(orgId: UUID, input: CreateCandidatoInput): Promise<Candidato> {
  const result = await pool.query<Candidato>(
    `INSERT INTO candidatos (organization_id, nombre, apellido, email, telefono,
      linkedin_url, habilidades, experiencia_anos, ubicacion, nivel_educativo,
      salario_esperado, fuente, notas)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      orgId, input.nombre, input.apellido, input.email,
      input.telefono ?? null, input.linkedin_url ?? null,
      JSON.stringify(input.habilidades), input.experiencia_anos,
      input.ubicacion ?? null, input.nivel_educativo ?? null,
      input.salario_esperado ?? null, input.fuente ?? 'Sitio web', input.notas ?? null,
    ]
  );
  return result.rows[0];
}

export async function updateCandidato(orgId: UUID, candidatoId: UUID, input: Partial<CreateCandidatoInput>): Promise<Candidato> {
  const fields: string[] = [];
  const params: unknown[] = [candidatoId, orgId];
  let paramIndex = 3;

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      if (key === 'habilidades') {
        fields.push(`${key} = $${paramIndex++}`);
        params.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${paramIndex++}`);
        params.push(value);
      }
    }
  }

  if (fields.length === 0) return getCandidato(orgId, candidatoId);
  fields.push('updated_at = NOW()');

  const result = await pool.query<Candidato>(
    `UPDATE candidatos SET ${fields.join(', ')} WHERE id = $1 AND organization_id = $2 RETURNING *`,
    params
  );
  if (result.rows.length === 0) throw new NotFoundError('Candidato', candidatoId);
  return result.rows[0];
}

export async function deleteCandidato(orgId: UUID, candidatoId: UUID): Promise<void> {
  const result = await pool.query(
    'DELETE FROM candidatos WHERE id = $1 AND organization_id = $2',
    [candidatoId, orgId]
  );
  if (result.rowCount === 0) throw new NotFoundError('Candidato', candidatoId);
}

export async function getAplicacionesByVacante(orgId: UUID, vacanteId: UUID): Promise<AplicacionConCandidato[]> {
  const result = await pool.query<AplicacionConCandidato>(
    `SELECT a.*,
      json_build_object(
        'id', c.id, 'nombre', c.nombre, 'apellido', c.apellido, 'email', c.email,
        'telefono', c.telefono, 'linkedin_url', c.linkedin_url, 'habilidades', c.habilidades,
        'experiencia_anos', c.experiencia_anos, 'cv_url', c.cv_url, 'fuente', c.fuente,
        'cv_parsed', c.cv_parsed, 'ubicacion', c.ubicacion, 'nivel_educativo', c.nivel_educativo
      ) as candidato
    FROM aplicaciones a
    JOIN candidatos c ON a.candidato_id = c.id
    WHERE a.vacante_id = $1 AND c.organization_id = $2
    ORDER BY a.score_ats DESC NULLS LAST, c.nombre ASC`,
    [vacanteId, orgId]
  );
  return result.rows;
}

export async function createAplicacion(orgId: UUID, input: CreateAplicacionInput): Promise<Aplicacion> {
  const result = await pool.query<Aplicacion>(
    `INSERT INTO aplicaciones (organization_id, vacante_id, candidato_id, notas)
    VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [orgId, input.vacante_id, input.candidato_id, input.notas_internas ?? null]
  );
  return result.rows[0];
}

export async function updateAplicacionEstado(
  orgId: UUID,
  aplicacionId: UUID,
  estado: string,
  motivoDescarte?: string
): Promise<Aplicacion> {
  const result = await pool.query<Aplicacion>(
    `UPDATE aplicaciones a SET estado = $3, motivo_descarte = $4, updated_at = NOW()
    FROM vacantes v
    WHERE a.id = $1 AND a.vacante_id = v.id AND v.organization_id = $2
    RETURNING a.*`,
    [aplicacionId, orgId, estado, motivoDescarte ?? null]
  );
  if (result.rows.length === 0) throw new NotFoundError('Aplicacion', aplicacionId);
  return result.rows[0];
}

export async function getAplicacion(orgId: UUID, aplicacionId: UUID): Promise<Aplicacion> {
  const result = await pool.query<Aplicacion>(
    `SELECT a.* FROM aplicaciones a
    JOIN vacantes v ON a.vacante_id = v.id
    WHERE a.id = $1 AND v.organization_id = $2`,
    [aplicacionId, orgId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Aplicacion', aplicacionId);
  return result.rows[0];
}
