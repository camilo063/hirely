import { NextRequest } from 'next/server';
import { getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);

    const vacanteId = searchParams.get('vacante_id') || null;
    const nivelRiesgo = searchParams.get('nivel_riesgo') || null;
    const desde = searchParams.get('desde') || null;
    const hasta = searchParams.get('hasta') || null;

    // KPIs (no filtered — org-wide summary)
    const kpisResult = await pool.query(
      `SELECT * FROM v_kpis_integridad WHERE organization_id = $1`,
      [orgId]
    );

    const kpis = kpisResult.rows.length > 0
      ? {
          total_evaluaciones_completadas: parseInt(kpisResult.rows[0].total_evaluaciones_completadas) || 0,
          evaluaciones_limpias: parseInt(kpisResult.rows[0].evaluaciones_limpias) || 0,
          riesgo_bajo: parseInt(kpisResult.rows[0].riesgo_bajo) || 0,
          riesgo_medio: parseInt(kpisResult.rows[0].riesgo_medio) || 0,
          riesgo_alto: parseInt(kpisResult.rows[0].riesgo_alto) || 0,
          pct_con_incidentes: parseFloat(kpisResult.rows[0].pct_con_incidentes) || 0,
          total_cambios_pestana: parseInt(kpisResult.rows[0].total_cambios_pestana) || 0,
          total_intentos_copia: parseInt(kpisResult.rows[0].total_intentos_copia) || 0,
          promedio_cambios_pestana: parseFloat(kpisResult.rows[0].promedio_cambios_pestana) || 0,
          promedio_intentos_copia: parseFloat(kpisResult.rows[0].promedio_intentos_copia) || 0,
          score_riesgo_promedio: parseFloat(kpisResult.rows[0].score_riesgo_promedio) || 0,
          score_promedio_riesgo_alto: kpisResult.rows[0].score_promedio_riesgo_alto
            ? parseFloat(kpisResult.rows[0].score_promedio_riesgo_alto)
            : null,
          score_promedio_sin_incidentes: kpisResult.rows[0].score_promedio_sin_incidentes
            ? parseFloat(kpisResult.rows[0].score_promedio_sin_incidentes)
            : null,
        }
      : {
          total_evaluaciones_completadas: 0,
          evaluaciones_limpias: 0,
          riesgo_bajo: 0,
          riesgo_medio: 0,
          riesgo_alto: 0,
          pct_con_incidentes: 0,
          total_cambios_pestana: 0,
          total_intentos_copia: 0,
          promedio_cambios_pestana: 0,
          promedio_intentos_copia: 0,
          score_riesgo_promedio: 0,
          score_promedio_riesgo_alto: null,
          score_promedio_sin_incidentes: null,
        };

    // Evaluaciones with filters
    const conditions: string[] = ['organization_id = $1'];
    const params: unknown[] = [orgId];
    let idx = 2;

    if (vacanteId) {
      conditions.push(`vacante_id = $${idx++}`);
      params.push(vacanteId);
    }
    if (nivelRiesgo) {
      conditions.push(`nivel_riesgo = $${idx++}`);
      params.push(nivelRiesgo);
    }
    if (desde) {
      conditions.push(`completada_at >= $${idx++}`);
      params.push(desde);
    }
    if (hasta) {
      conditions.push(`completada_at <= $${idx++}`);
      params.push(hasta);
    }

    const where = conditions.join(' AND ');
    const evalsResult = await pool.query(
      `SELECT evaluacion_id, candidato_nombre, candidato_email, vacante_titulo,
              cambios_pestana, intentos_copia, score_total, aprobada,
              nivel_riesgo, score_riesgo, completada_at
       FROM v_integridad_evaluaciones
       WHERE ${where}
       ORDER BY score_riesgo DESC, completada_at DESC
       LIMIT 100`,
      params
    );

    // Distribution
    const distResult = await pool.query(
      `SELECT rango_eventos, cantidad_evaluaciones::int
       FROM v_distribucion_incidentes
       WHERE organization_id = $1`,
      [orgId]
    );

    return apiResponse({
      kpis,
      evaluaciones: evalsResult.rows,
      distribucion: distResult.rows,
    });
  } catch (error) {
    return apiError(error);
  }
}
