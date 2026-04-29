import { NextRequest } from 'next/server';
import { getOrgId } from '@/lib/auth/middleware';
import { pool } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export const maxDuration = 10;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;

    const result = await pool.query(
      `SELECT a.*, v.titulo as vacante_titulo, v.departamento as vacante_departamento,
              tc.motivo as terminacion_motivo,
              tc.motivo_detalle as terminacion_detalle,
              tc.fecha_terminacion as terminacion_fecha,
              tc.notas as terminacion_notas
       FROM aplicaciones a
       JOIN vacantes v ON v.id = a.vacante_id
       LEFT JOIN terminaciones_contrato tc ON tc.aplicacion_id = a.id
       WHERE a.candidato_id = $1 AND a.organization_id = $2
       ORDER BY a.created_at DESC`,
      [id, orgId]
    );

    return apiResponse(result.rows);
  } catch (error) {
    return apiError(error);
  }
}
