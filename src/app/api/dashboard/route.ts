import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { pool } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    // Stats + pipeline + recent vacantes + recent activity in parallel
    const [statsResult, pipelineResult, recentVacantesResult, activityResult] = await Promise.all([
      pool.query(
        `SELECT
          (SELECT COUNT(*) FROM vacantes WHERE organization_id = $1 AND estado = 'publicada')::int as vacantes_activas,
          (SELECT COUNT(*) FROM candidatos WHERE organization_id = $1)::int as total_candidatos,
          (SELECT COUNT(*) FROM aplicaciones a JOIN vacantes v ON a.vacante_id = v.id WHERE v.organization_id = $1 AND a.estado NOT IN ('descartado', 'contratado'))::int as en_proceso,
          (SELECT COUNT(*) FROM aplicaciones a JOIN vacantes v ON a.vacante_id = v.id WHERE v.organization_id = $1 AND a.estado = 'contratado')::int as contratados,
          (SELECT COUNT(*) FROM entrevistas_ia ei JOIN aplicaciones a ON ei.aplicacion_id = a.id JOIN vacantes v ON a.vacante_id = v.id WHERE v.organization_id = $1 AND ei.estado = 'pendiente')::int as entrevistas_pendientes`,
        [orgId]
      ),
      pool.query(
        `SELECT a.estado, COUNT(*)::int as count
         FROM aplicaciones a
         JOIN vacantes v ON a.vacante_id = v.id
         WHERE v.organization_id = $1
         GROUP BY a.estado
         ORDER BY a.estado`,
        [orgId]
      ),
      pool.query(
        `SELECT v.id, v.titulo, v.estado, v.departamento, v.ubicacion, v.created_at,
          COALESCE(stats.total, 0)::int as total_aplicaciones,
          COALESCE(stats.en_proceso, 0)::int as en_proceso
         FROM vacantes v
         LEFT JOIN LATERAL (
           SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE a.estado NOT IN ('descartado', 'contratado')) as en_proceso
           FROM aplicaciones a WHERE a.vacante_id = v.id
         ) stats ON true
         WHERE v.organization_id = $1
         ORDER BY v.created_at DESC
         LIMIT 5`,
        [orgId]
      ),
      pool.query(
        `(SELECT 'aplicacion' as tipo, c.nombre || ' ' || COALESCE(c.apellido, '') as descripcion,
            'aplico a ' || v.titulo as detalle, a.created_at
          FROM aplicaciones a
          JOIN candidatos c ON a.candidato_id = c.id
          JOIN vacantes v ON a.vacante_id = v.id
          WHERE v.organization_id = $1
          ORDER BY a.created_at DESC LIMIT 5)
         UNION ALL
         (SELECT 'entrevista_ia' as tipo, c.nombre || ' ' || COALESCE(c.apellido, '') as descripcion,
            'entrevista IA para ' || v.titulo as detalle, ei.created_at
          FROM entrevistas_ia ei
          JOIN aplicaciones a ON ei.aplicacion_id = a.id
          JOIN candidatos c ON a.candidato_id = c.id
          JOIN vacantes v ON a.vacante_id = v.id
          WHERE v.organization_id = $1
          ORDER BY ei.created_at DESC LIMIT 3)
         ORDER BY created_at DESC
         LIMIT 8`,
        [orgId]
      ),
    ]);

    return apiResponse({
      stats: statsResult.rows[0],
      pipeline: pipelineResult.rows,
      recentVacantes: recentVacantesResult.rows,
      activity: activityResult.rows,
    });
  } catch (error) {
    return apiError(error);
  }
}
