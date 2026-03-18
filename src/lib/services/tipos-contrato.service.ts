import { pool } from '@/lib/db';
import { UUID } from '@/lib/types/common.types';

export interface TipoContratoRow {
  id: UUID;
  organization_id: UUID;
  nombre: string;
  slug: string;
  descripcion: string | null;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export async function listTiposContrato(orgId: UUID, onlyActive = true): Promise<TipoContratoRow[]> {
  const result = await pool.query(
    `SELECT * FROM tipos_contrato
     WHERE organization_id = $1 ${onlyActive ? 'AND is_active = true' : ''}
     ORDER BY is_system DESC, nombre ASC`,
    [orgId]
  );
  return result.rows;
}

export async function getTipoContrato(orgId: UUID, id: UUID): Promise<TipoContratoRow | null> {
  const result = await pool.query(
    'SELECT * FROM tipos_contrato WHERE id = $1 AND organization_id = $2',
    [id, orgId]
  );
  return result.rows[0] || null;
}

export async function getTipoContratoBySlug(orgId: UUID, slug: string): Promise<TipoContratoRow | null> {
  const result = await pool.query(
    'SELECT * FROM tipos_contrato WHERE slug = $1 AND organization_id = $2 AND is_active = true',
    [slug, orgId]
  );
  return result.rows[0] || null;
}

export async function createTipoContrato(
  orgId: UUID,
  data: { nombre: string; slug?: string; descripcion?: string }
): Promise<TipoContratoRow> {
  const slug = data.slug || slugify(data.nombre);

  const result = await pool.query(
    `INSERT INTO tipos_contrato (organization_id, nombre, slug, descripcion)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [orgId, data.nombre, slug, data.descripcion || null]
  );
  return result.rows[0];
}

export async function updateTipoContrato(
  orgId: UUID,
  id: UUID,
  data: { nombre?: string; descripcion?: string; is_active?: boolean }
): Promise<TipoContratoRow> {
  const existing = await getTipoContrato(orgId, id);
  if (!existing) throw new Error('Tipo de contrato no encontrado');

  const nombre = data.nombre ?? existing.nombre;
  const descripcion = data.descripcion ?? existing.descripcion;
  const isActive = data.is_active ?? existing.is_active;

  const result = await pool.query(
    `UPDATE tipos_contrato
     SET nombre = $1, descripcion = $2, is_active = $3, updated_at = NOW()
     WHERE id = $4 AND organization_id = $5
     RETURNING *`,
    [nombre, descripcion, isActive, id, orgId]
  );
  return result.rows[0];
}

export async function deleteTipoContrato(orgId: UUID, id: UUID): Promise<void> {
  const existing = await getTipoContrato(orgId, id);
  if (!existing) throw new Error('Tipo de contrato no encontrado');
  if (existing.is_system) throw new Error('No se pueden eliminar tipos de contrato del sistema');

  // Check if referenced by existing contracts
  const refs = await pool.query(
    'SELECT COUNT(*) as count FROM contratos WHERE tipo = $1 AND organization_id = $2',
    [existing.slug, orgId]
  );
  if (parseInt(refs.rows[0].count) > 0) {
    // Soft delete if referenced
    await pool.query(
      'UPDATE tipos_contrato SET is_active = false, updated_at = NOW() WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    );
    return;
  }

  await pool.query(
    'DELETE FROM tipos_contrato WHERE id = $1 AND organization_id = $2',
    [id, orgId]
  );
}

export async function seedDefaultTiposForOrg(orgId: UUID): Promise<void> {
  const defaults = [
    { nombre: 'Indefinido', slug: 'indefinido', descripcion: 'Contrato a termino indefinido' },
    { nombre: 'Termino Fijo', slug: 'termino_fijo', descripcion: 'Contrato a termino fijo' },
    { nombre: 'Prestacion de Servicios', slug: 'prestacion_servicios', descripcion: 'Contrato de prestacion de servicios' },
    { nombre: 'Obra o Labor', slug: 'obra_labor', descripcion: 'Contrato por obra o labor determinada' },
    { nombre: 'Aprendizaje', slug: 'aprendizaje', descripcion: 'Contrato de aprendizaje' },
  ];

  for (const d of defaults) {
    await pool.query(
      `INSERT INTO tipos_contrato (organization_id, nombre, slug, descripcion, is_system)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (organization_id, slug) DO NOTHING`,
      [orgId, d.nombre, d.slug, d.descripcion]
    );
  }
}
