import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { pool } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils/api-response';

// GET — obtener mapeos actuales + datos para los selects
export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    // Mapeos existentes
    const mapeos = await pool.query(
      `SELECT m.id, m.tipo_contrato_slug, m.plantilla_id, p.nombre as plantilla_nombre
       FROM tipo_plantilla_mapeo m
       JOIN plantillas_contrato p ON p.id = m.plantilla_id
       WHERE m.organization_id = $1
       ORDER BY m.tipo_contrato_slug`,
      [orgId]
    );

    // Tipos de contrato disponibles
    const tipos = await pool.query(
      `SELECT DISTINCT slug, nombre FROM tipos_contrato
       WHERE organization_id = $1 AND is_active = true
       ORDER BY nombre`,
      [orgId]
    );

    // Plantillas disponibles
    const plantillas = await pool.query(
      `SELECT id, nombre, tipo FROM plantillas_contrato
       WHERE organization_id = $1 AND is_active = true
       ORDER BY nombre`,
      [orgId]
    );

    return apiResponse({
      mapeos: mapeos.rows,
      tipos: tipos.rows,
      plantillas: plantillas.rows,
    });
  } catch (error) {
    return apiError(error);
  }
}

// POST — crear o actualizar un mapeo
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const body = await request.json();

    const { tipo_contrato_slug, plantilla_id } = body;
    if (!tipo_contrato_slug || !plantilla_id) {
      return apiResponse({ error: 'tipo_contrato_slug y plantilla_id son requeridos' }, 422);
    }

    // Upsert
    const result = await pool.query(
      `INSERT INTO tipo_plantilla_mapeo (organization_id, tipo_contrato_slug, plantilla_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, tipo_contrato_slug)
       DO UPDATE SET plantilla_id = $3, updated_at = NOW()
       RETURNING *`,
      [orgId, tipo_contrato_slug, plantilla_id]
    );

    return apiResponse(result.rows[0]);
  } catch (error) {
    return apiError(error);
  }
}

// DELETE — eliminar un mapeo
export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiResponse({ error: 'id es requerido' }, 422);
    }

    await pool.query(
      `DELETE FROM tipo_plantilla_mapeo WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );

    return apiResponse({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
