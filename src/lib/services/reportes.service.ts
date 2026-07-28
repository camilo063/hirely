import { pool } from '../db';
import type {
  KPIsGenerales,
  FunnelData,
  FunnelEtapa,
  TiemposPorEtapa,
  VolumenSemana,
  TopVacante,
  FiltrosReporte,
} from '../types/reportes.types';

/**
 * Etapas del funnel.
 *
 * Debe cubrir TODOS los estados del pipeline. Antes faltaban `revisado`,
 * `documentos_pendientes`, `documentos_completos`, `contrato_terminado` y
 * `descartado`, pero el total si los contaba: los candidatos en esos estados
 * desaparecian del grafico y los porcentajes sumaban menos de 100 (medido: 66%
 * sobre 3 aplicaciones). Los labels siguen el catalogo de pipeline-states.ts.
 */
const ORDEN_ETAPAS = [
  { key: 'nuevo', label: 'Nuevos', color: '#6366f1' },
  { key: 'en_revision', label: 'En revisión', color: '#8b5cf6' },
  { key: 'preseleccionado', label: 'Preseleccionados', color: '#00BCD4' },
  { key: 'entrevista_ia', label: 'Entrevista IA', color: '#0ea5e9' },
  { key: 'prueba_tecnica', label: 'Prueba técnica', color: '#06b6d4' },
  { key: 'entrevista_humana', label: 'Entrevista humana', color: '#10b981' },
  { key: 'evaluado', label: 'A evaluar', color: '#f59e0b' },
  { key: 'seleccionado', label: 'Seleccionados', color: '#FF6B35' },
  { key: 'documentos_pendientes', label: 'Documentos pendientes', color: '#f97316' },
  { key: 'documentos_completos', label: 'Documentos completos', color: '#84cc16' },
  { key: 'contratado', label: 'Contratados', color: '#10B981' },
  { key: 'contrato_terminado', label: 'Contrato terminado', color: '#64748b' },
  { key: 'descartado', label: 'Descartados', color: '#ef4444' },
];

/** Descarta fechas que Postgres no puede interpretar (evita el 500 por `date_trunc('hola')`). */
function fechaValida(v?: string | null): string | null {
  if (!v) return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

/** Descarta identificadores que no son UUID (evita el 500 por comparacion invalida). */
export function uuidValido(v?: string | null): string | null {
  if (!v) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
}

function calcularFechasFiltro(filtros?: FiltrosReporte): { desde: string | null; hasta: string | null } {
  if (!filtros) return { desde: null, hasta: null };

  // Las fechas llegan del querystring. Una cadena como 'hola' o '9999-99-99'
  // hacia reventar la consulta con 500; aqui simplemente se descartan.
  filtros = {
    ...filtros,
    desde: fechaValida(filtros.desde) ?? undefined,
    hasta: fechaValida(filtros.hasta) ?? undefined,
  };

  if (filtros.periodo && filtros.periodo !== 'custom') {
    const dias: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '180d': 180,
      '365d': 365,
    };
    const d = new Date();
    d.setDate(d.getDate() - (dias[filtros.periodo] || 90));
    return { desde: d.toISOString().split('T')[0], hasta: null };
  }

  return {
    desde: filtros.desde || null,
    hasta: filtros.hasta || null,
  };
}

export async function obtenerKPIsGenerales(organizationId: string): Promise<KPIsGenerales> {
  const result = await pool.query(
    `SELECT * FROM v_kpis_generales WHERE organization_id = $1`,
    [organizationId]
  );

  if (result.rows.length === 0) {
    return {
      vacantesActivas: 0,
      vacantasCerradas30d: 0,
      totalCandidatos: 0,
      totalAplicaciones: 0,
      totalContratados: 0,
      aplicaciones90d: 0,
      contratados90d: 0,
      tasaConversionGlobal: 0,
      scoreAtsPromedio: null,
      scoreIaPromedio: null,
      scoreHumanoPromedio: null,
      scoreTecnicoPromedio: null,
      scoreFinalPromedio: null,
      entrevistasIaCompletadas: 0,
      entrevistasHumanasCompletadas: 0,
      contratosFirmados: 0,
    };
  }

  const row = result.rows[0];
  const aplicaciones90d = parseInt(row.aplicaciones_90d) || 0;
  const contratados90d = parseInt(row.contratados_90d) || 0;

  return {
    vacantesActivas: parseInt(row.vacantes_activas) || 0,
    vacantasCerradas30d: parseInt(row.vacantes_cerradas_30d) || 0,
    totalCandidatos: parseInt(row.total_candidatos) || 0,
    totalAplicaciones: parseInt(row.total_aplicaciones) || 0,
    totalContratados: parseInt(row.total_contratados) || 0,
    aplicaciones90d,
    contratados90d,
    // Se acota a [0,100]: `contratados90d` y `aplicaciones90d` son cohortes
    // distintas (contrataciones recientes de candidatos que pudieron postularse
    // hace un año), asi que el cociente podia superar el 100% — se llego a medir
    // 133.3%. La vista ya usa `seleccionado_at` en vez de `updated_at`, lo que
    // elimina el grueso del desfase; este tope evita mostrar un imposible.
    tasaConversionGlobal: aplicaciones90d > 0
      ? Math.min(100, Math.round((contratados90d / aplicaciones90d) * 1000) / 10)
      : 0,
    scoreAtsPromedio: row.score_ats_promedio ? parseFloat(row.score_ats_promedio) : null,
    scoreIaPromedio: row.score_ia_promedio ? parseFloat(row.score_ia_promedio) : null,
    scoreHumanoPromedio: row.score_humano_promedio ? parseFloat(row.score_humano_promedio) : null,
    scoreTecnicoPromedio: row.score_tecnico_promedio ? parseFloat(row.score_tecnico_promedio) : null,
    scoreFinalPromedio: row.score_final_promedio ? parseFloat(row.score_final_promedio) : null,
    entrevistasIaCompletadas: parseInt(row.entrevistas_ia_completadas) || 0,
    entrevistasHumanasCompletadas: parseInt(row.entrevistas_humanas_completadas) || 0,
    contratosFirmados: parseInt(row.contratos_firmados) || 0,
  };
}

export async function obtenerFunnelConversion(
  organizationId: string,
  filtros?: FiltrosReporte
): Promise<FunnelData> {
  const { desde, hasta } = calcularFechasFiltro(filtros);
  const vacanteId = filtros?.vacanteId || null;

  // Embudo ACUMULATIVO: cuenta cuantos candidatos LLEGARON a cada etapa, no
  // cuantos estan ahi ahora mismo.
  //
  // Antes se agrupaba por `estado` actual, asi que un candidato ya contratado no
  // aparecia en "Nuevos" ni en "Preseleccionados": el grafico mostraba 0 en las
  // primeras etapas aunque todo el mundo hubiera pasado por ellas, y las barras
  // no decrecian — o sea, no era un embudo. `estados_completados` guarda el
  // historial, asi que basta con contar "esta aqui O ya paso por aqui".
  const claves = ORDEN_ETAPAS.map((e) => e.key);

  const result = await pool.query(
    `SELECT
       k.clave,
       COUNT(a.id) FILTER (
         WHERE a.estado = k.clave OR k.clave = ANY(a.estados_completados)
       ) AS cantidad
     FROM unnest($5::text[]) AS k(clave)
     LEFT JOIN aplicaciones a
       ON a.organization_id = $1
      AND ($2::uuid IS NULL OR a.vacante_id = $2)
      AND ($3::date IS NULL OR a.created_at >= $3)
      AND ($4::date IS NULL OR a.created_at <= $4)
     GROUP BY k.clave`,
    [organizationId, vacanteId, desde, hasta, claves]
  );

  const totalResult = await pool.query(
    `SELECT COUNT(*) AS total
     FROM aplicaciones
     WHERE organization_id = $1
       AND ($2::uuid IS NULL OR vacante_id = $2)
       AND ($3::date IS NULL OR created_at >= $3)
       AND ($4::date IS NULL OR created_at <= $4)`,
    [organizationId, vacanteId, desde, hasta]
  );

  const conteosPorEstado: Record<string, number> = {};
  for (const row of result.rows) {
    conteosPorEstado[row.clave] = parseInt(row.cantidad) || 0;
  }
  const totalConDescartados = parseInt(totalResult.rows[0]?.total) || 0;

  const etapas: FunnelEtapa[] = ORDEN_ETAPAS.map((e) => {
    const cantidad = conteosPorEstado[e.key] || 0;
    return {
      etapa: e.label,
      key: e.key,
      cantidad,
      porcentaje: totalConDescartados > 0
        ? Math.round((cantidad / totalConDescartados) * 1000) / 10
        : 0,
      color: e.color,
    };
  });

  const data: FunnelData = {
    etapas,
    totalAplicaciones: totalConDescartados,
  };

  if (vacanteId) {
    const vacResult = await pool.query(
      `SELECT titulo FROM vacantes WHERE id = $1 AND organization_id = $2`,
      [vacanteId, organizationId]
    );
    if (vacResult.rows.length > 0) {
      data.porVacante = {
        vacanteId,
        vacanteTitulo: vacResult.rows[0].titulo,
      };
    }
  }

  return data;
}

export async function obtenerTiemposPorEtapa(
  organizationId: string
): Promise<TiemposPorEtapa> {
  const result = await pool.query(
    `SELECT * FROM v_tiempos_por_etapa WHERE organization_id = $1`,
    [organizationId]
  );

  if (result.rows.length === 0) {
    return {
      diasAplicacionAEntrevistaIa: null,
      diasEntrevistaIaAHumana: null,
      diasHumanaAEvaluacion: null,
      diasTotalContratacion: null,
    };
  }

  const row = result.rows[0];
  return {
    diasAplicacionAEntrevistaIa: row.dias_aplicacion_a_entrevista_ia
      ? parseFloat(row.dias_aplicacion_a_entrevista_ia)
      : null,
    diasEntrevistaIaAHumana: row.dias_entrevista_ia_a_humana
      ? parseFloat(row.dias_entrevista_ia_a_humana)
      : null,
    diasHumanaAEvaluacion: row.dias_humana_a_evaluacion
      ? parseFloat(row.dias_humana_a_evaluacion)
      : null,
    diasTotalContratacion: row.dias_total_contratacion
      ? parseFloat(row.dias_total_contratacion)
      : null,
  };
}

export async function obtenerVolumenSemanal(
  organizationId: string,
  filtros?: FiltrosReporte
): Promise<VolumenSemana[]> {
  // Se filtra por FECHA, no por "las N semanas con datos". Con `LIMIT n` a secas,
  // pedir "ultimos 7 dias" devolvia las 2 semanas mas recientes QUE TUVIERAN
  // datos — se midieron semanas de hace mes y medio — y ademas saltaba las
  // semanas vacias, con lo que el eje X no era contiguo y la tendencia mentia.
  // Serie CONTINUA de semanas dentro del periodo pedido.
  //
  // Dos fallos que arregla: (a) `7d` devolvia datos de hasta 15 dias atras
  // porque la ventana se calculaba en semanas completas hacia atras; ahora el
  // corte es el periodo real en dias. (b) las semanas SIN datos se omitian, con
  // lo que el eje X no era contiguo y la pendiente de la tendencia mentia:
  // `generate_series` las rellena con ceros.
  const dias: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 };
  const diasPeriodo = dias[filtros?.periodo || '90d'] || 90;

  const result = await pool.query(
    `WITH semanas AS (
       SELECT generate_series(
         date_trunc('week', NOW() - ($2::int * INTERVAL '1 day')),
         date_trunc('week', NOW()),
         INTERVAL '1 week'
       )::date AS semana
     )
     SELECT s.semana,
            COALESCE(v.total_aplicaciones, 0) AS total_aplicaciones,
            COALESCE(v.contratados, 0)        AS contratados,
            COALESCE(v.descartados, 0)        AS descartados
     FROM semanas s
     LEFT JOIN v_volumen_semanal v
       ON v.semana = s.semana AND v.organization_id = $1
     ORDER BY s.semana DESC`,
    [organizationId, diasPeriodo]
  );

  return result.rows.reverse().map((row) => {
    const semanaDate = new Date(row.semana);
    const endDate = new Date(semanaDate);
    endDate.setDate(endDate.getDate() + 6);

    const formatShort = (d: Date) => {
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${months[d.getMonth()]} ${d.getDate()}`;
    };

    return {
      semana: row.semana,
      semanaLabel: `${formatShort(semanaDate)} – ${formatShort(endDate)}`,
      totalAplicaciones: parseInt(row.total_aplicaciones) || 0,
      contratados: parseInt(row.contratados) || 0,
      descartados: parseInt(row.descartados) || 0,
    };
  });
}

export async function obtenerTopVacantes(
  organizationId: string,
  limite: number = 10
): Promise<TopVacante[]> {
  const result = await pool.query(
    `SELECT * FROM fn_top_vacantes_conversion($1, $2)`,
    [organizationId, limite]
  );

  return result.rows.map((row) => ({
    vacanteId: row.vacante_id,
    titulo: row.titulo,
    totalAplicaciones: parseInt(row.total_aplicaciones) || 0,
    contratados: parseInt(row.contratados) || 0,
    tasaConversion: row.tasa_conversion ? parseFloat(row.tasa_conversion) : 0,
    scorePromedio: row.score_promedio ? parseFloat(row.score_promedio) : null,
    diasAbierta: row.dias_abierta ? parseFloat(row.dias_abierta) : 0,
  }));
}

export async function obtenerDistribucionScores(
  organizationId: string,
  filtros?: FiltrosReporte
): Promise<{ rango: string; candidatos: number; label: string }[]> {
  const { desde, hasta } = calcularFechasFiltro(filtros);
  const vacanteId = filtros?.vacanteId || null;

  const result = await pool.query(
    `SELECT
      CASE
        WHEN score_final >= 0 AND score_final <= 20 THEN '0-20'
        WHEN score_final > 20 AND score_final <= 40 THEN '21-40'
        WHEN score_final > 40 AND score_final <= 60 THEN '41-60'
        WHEN score_final > 60 AND score_final <= 80 THEN '61-80'
        WHEN score_final > 80 AND score_final <= 100 THEN '81-100'
      END AS rango,
      COUNT(*) AS candidatos
    FROM aplicaciones
    WHERE organization_id = $1
      AND score_final IS NOT NULL
      AND ($2::uuid IS NULL OR vacante_id = $2)
      AND ($3::date IS NULL OR created_at >= $3)
      AND ($4::date IS NULL OR created_at <= $4)
    GROUP BY rango
    ORDER BY rango`,
    [organizationId, vacanteId, desde, hasta]
  );

  const labels: Record<string, string> = {
    '0-20': 'Muy bajo',
    '21-40': 'Bajo',
    '41-60': 'Medio',
    '61-80': 'Alto',
    '81-100': 'Excelente',
  };

  const rangos = ['0-20', '21-40', '41-60', '61-80', '81-100'];
  const conteos: Record<string, number> = {};
  for (const row of result.rows) {
    if (row.rango) {
      conteos[row.rango] = parseInt(row.candidatos) || 0;
    }
  }

  return rangos.map((rango) => ({
    rango,
    candidatos: conteos[rango] || 0,
    label: labels[rango],
  }));
}

export async function obtenerVacantesParaFiltro(
  organizationId: string
): Promise<{ id: string; titulo: string }[]> {
  const result = await pool.query(
    `SELECT id, titulo FROM vacantes WHERE organization_id = $1 ORDER BY created_at DESC`,
    [organizationId]
  );
  return result.rows;
}
