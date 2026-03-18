import { pool } from '../db';
import { UUID } from '../types/common.types';
import { Vacante } from '../types/vacante.types';
import { Candidato } from '../types/candidato.types';
import { NotFoundError } from '../utils/errors';

/**
 * Fetch a published vacancy by ID — no org scoping needed (public).
 */
export async function getPublicVacante(vacanteId: UUID): Promise<Vacante> {
  const result = await pool.query<Vacante>(
    `SELECT * FROM vacantes WHERE id = $1 AND estado = 'publicada'`,
    [vacanteId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Vacante', vacanteId);
  return result.rows[0];
}

/**
 * Find an existing candidato by (organization_id, email) or create a new one.
 * If found, updates linkedin_url if it was missing.
 */
export async function findOrCreateCandidato(
  orgId: UUID,
  data: {
    nombre: string;
    apellido: string;
    email: string;
    linkedin_url: string | null;
  }
): Promise<Candidato> {
  const existing = await pool.query<Candidato>(
    `SELECT * FROM candidatos WHERE organization_id = $1 AND email = $2`,
    [orgId, data.email]
  );

  if (existing.rows.length > 0) {
    const candidato = existing.rows[0];
    // Backfill linkedin_url if missing
    if (!candidato.linkedin_url && data.linkedin_url) {
      await pool.query(
        `UPDATE candidatos SET linkedin_url = $1, updated_at = NOW() WHERE id = $2`,
        [data.linkedin_url, candidato.id]
      );
      candidato.linkedin_url = data.linkedin_url;
    }
    return candidato;
  }

  const result = await pool.query<Candidato>(
    `INSERT INTO candidatos (organization_id, nombre, apellido, email, linkedin_url, fuente, habilidades, experiencia_anos)
     VALUES ($1, $2, $3, $4, $5, 'LinkedIn', '[]'::jsonb, 0)
     RETURNING *`,
    [orgId, data.nombre, data.apellido, data.email, data.linkedin_url]
  );
  return result.rows[0];
}

/**
 * Create an aplicacion for the candidate + vacancy.
 * Catches unique-constraint violation (23505) for duplicate applications.
 */
export async function createPublicAplicacion(
  orgId: UUID,
  vacanteId: UUID,
  candidatoId: UUID
): Promise<{ aplicacionId: UUID; alreadyApplied: boolean }> {
  try {
    const result = await pool.query(
      `INSERT INTO aplicaciones (organization_id, vacante_id, candidato_id, estado, origen)
       VALUES ($1, $2, $3, 'nuevo', 'linkedin')
       RETURNING id`,
      [orgId, vacanteId, candidatoId]
    );
    return { aplicacionId: result.rows[0].id, alreadyApplied: false };
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      return { aplicacionId: '', alreadyApplied: true };
    }
    throw err;
  }
}
