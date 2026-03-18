import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';

// GET /api/scoring/dual?vacante_id=xxx — Dashboard de scoring dual por vacante
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    const vacanteId = request.nextUrl.searchParams.get('vacante_id');
    if (!vacanteId) return apiError(new Error('vacante_id es requerido'));

    const result = await pool.query(
      `SELECT
         c.id, c.nombre, c.apellido, c.email,
         a.id as aplicacion_id,
         a.score_ats, a.score_ia, a.score_humano, a.score_tecnico, a.score_final,
         a.peso_ia, a.peso_humano, a.estado,
         ABS(COALESCE(a.score_ia, 0) - COALESCE(a.score_humano, 0)) as discrepancia,
         ei.analisis as analisis_ia,
         eh.evaluacion as evaluacion_humana,
         ev.score_total as eval_tecnica_score,
         ev.aprobada as eval_tecnica_aprobada
       FROM aplicaciones a
       JOIN candidatos c ON c.id = a.candidato_id
       JOIN vacantes v ON v.id = a.vacante_id
       LEFT JOIN entrevistas_ia ei ON ei.aplicacion_id = a.id AND ei.estado = 'completada'
       LEFT JOIN entrevistas_humanas eh ON eh.aplicacion_id = a.id AND eh.estado = 'realizada'
       LEFT JOIN evaluaciones ev ON ev.id = a.evaluacion_tecnica_id
       WHERE a.vacante_id = $1 AND v.organization_id = $2
         AND (a.score_ia IS NOT NULL OR a.score_humano IS NOT NULL OR a.score_tecnico IS NOT NULL)
       ORDER BY a.score_final DESC NULLS LAST, a.score_ia DESC NULLS LAST`,
      [vacanteId, orgId]
    );

    return apiResponse(result.rows);
  } catch (error) {
    return apiError(error);
  }
}
