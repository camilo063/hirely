-- =====================================================
-- Migración 016: Reportes y Analytics
-- Vistas SQL, funciones e índices para el módulo de reportes
-- =====================================================

-- =====================================================
-- VISTA: Métricas del funnel por organización
-- =====================================================
CREATE OR REPLACE VIEW v_funnel_aplicaciones AS
SELECT
  a.organization_id,
  a.vacante_id,
  v.titulo AS vacante_titulo,
  v.estado AS vacante_estado,

  COUNT(*) FILTER (WHERE a.estado = 'nuevo')               AS etapa_nuevo,
  COUNT(*) FILTER (WHERE a.estado = 'revisado')            AS etapa_revisado,
  COUNT(*) FILTER (WHERE a.estado = 'preseleccionado')     AS etapa_preseleccionado,
  COUNT(*) FILTER (WHERE a.estado = 'entrevista_ia')       AS etapa_entrevista_ia,
  COUNT(*) FILTER (WHERE a.estado = 'entrevista_humana')   AS etapa_entrevista_humana,
  COUNT(*) FILTER (WHERE a.estado = 'evaluado')            AS etapa_evaluado,
  COUNT(*) FILTER (WHERE a.estado = 'seleccionado')        AS etapa_seleccionado,
  COUNT(*) FILTER (WHERE a.estado = 'contratado')          AS etapa_contratado,
  COUNT(*) FILTER (WHERE a.estado = 'descartado')          AS etapa_descartado,
  COUNT(*)                                                  AS total_aplicaciones

FROM aplicaciones a
JOIN vacantes v ON v.id = a.vacante_id
GROUP BY a.organization_id, a.vacante_id, v.titulo, v.estado;

-- =====================================================
-- VISTA: Tiempos promedio por etapa (en días)
-- =====================================================
CREATE OR REPLACE VIEW v_tiempos_por_etapa AS
WITH transiciones AS (
  SELECT
    a.organization_id,
    a.id AS aplicacion_id,
    a.created_at                                    AS fecha_aplicacion,
    ei.created_at                                   AS fecha_entrevista_ia,
    eh.created_at                                   AS fecha_entrevista_humana,
    ev.created_at                                   AS fecha_evaluacion,
    CASE WHEN a.estado = 'contratado' THEN a.updated_at END AS fecha_contratacion
  FROM aplicaciones a
  LEFT JOIN entrevistas_ia ei       ON ei.aplicacion_id = a.id
  LEFT JOIN entrevistas_humanas eh  ON eh.aplicacion_id = a.id
  LEFT JOIN evaluaciones ev         ON ev.aplicacion_id = a.id
)
SELECT
  organization_id,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (fecha_entrevista_ia - fecha_aplicacion)) / 86400
  )::numeric, 1)   AS dias_aplicacion_a_entrevista_ia,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (fecha_entrevista_humana - fecha_entrevista_ia)) / 86400
  )::numeric, 1)   AS dias_entrevista_ia_a_humana,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (fecha_evaluacion - fecha_entrevista_humana)) / 86400
  )::numeric, 1)   AS dias_humana_a_evaluacion,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (fecha_contratacion - fecha_aplicacion)) / 86400
  )::numeric, 1)   AS dias_total_contratacion
FROM transiciones
WHERE organization_id IS NOT NULL
GROUP BY organization_id;

-- =====================================================
-- VISTA: Volumen de aplicaciones por semana
-- =====================================================
CREATE OR REPLACE VIEW v_volumen_semanal AS
SELECT
  organization_id,
  DATE_TRUNC('week', created_at)::DATE  AS semana,
  COUNT(*)                               AS total_aplicaciones,
  COUNT(*) FILTER (WHERE estado = 'contratado')  AS contratados,
  COUNT(*) FILTER (WHERE estado = 'descartado')  AS descartados
FROM aplicaciones
GROUP BY organization_id, DATE_TRUNC('week', created_at)
ORDER BY semana DESC;

-- =====================================================
-- VISTA: Resumen general de KPIs por organización
-- =====================================================
CREATE OR REPLACE VIEW v_kpis_generales AS
SELECT
  o.id                                                        AS organization_id,
  o.name                                                      AS organization_name,

  COUNT(DISTINCT v.id) FILTER (WHERE v.estado = 'publicada')  AS vacantes_activas,
  COUNT(DISTINCT v.id) FILTER (WHERE v.estado = 'cerrada'
    AND v.updated_at >= NOW() - INTERVAL '30 days')           AS vacantes_cerradas_30d,

  COUNT(DISTINCT c.id)                                        AS total_candidatos,
  COUNT(DISTINCT a.id)                                        AS total_aplicaciones,
  COUNT(DISTINCT a.id) FILTER (WHERE a.estado = 'contratado') AS total_contratados,

  COUNT(DISTINCT a.id) FILTER (
    WHERE a.created_at >= NOW() - INTERVAL '90 days'
  )                                                           AS aplicaciones_90d,
  COUNT(DISTINCT a.id) FILTER (
    WHERE a.estado = 'contratado'
    AND a.updated_at >= NOW() - INTERVAL '90 days'
  )                                                           AS contratados_90d,

  ROUND(AVG(a.score_ats)::numeric, 1)                        AS score_ats_promedio,
  ROUND(AVG(a.score_ia)::numeric, 1)                         AS score_ia_promedio,
  ROUND(AVG(a.score_humano)::numeric, 1)                     AS score_humano_promedio,
  ROUND(AVG(a.score_tecnico)::numeric, 1)                    AS score_tecnico_promedio,
  ROUND(AVG(a.score_final)::numeric, 1)                      AS score_final_promedio,

  COUNT(DISTINCT ei.id) FILTER (WHERE ei.estado = 'completada') AS entrevistas_ia_completadas,
  COUNT(DISTINCT eh.id) FILTER (WHERE eh.estado = 'completada') AS entrevistas_humanas_completadas,

  COUNT(DISTINCT con.id) FILTER (WHERE con.estado = 'firmado') AS contratos_firmados

FROM organizations o
LEFT JOIN vacantes v     ON v.organization_id = o.id
LEFT JOIN candidatos c   ON c.organization_id = o.id
LEFT JOIN aplicaciones a ON a.organization_id = o.id
LEFT JOIN entrevistas_ia ei       ON ei.organization_id = o.id
LEFT JOIN entrevistas_humanas eh  ON eh.organization_id = o.id
LEFT JOIN contratos con           ON con.organization_id = o.id
GROUP BY o.id, o.name;

-- =====================================================
-- FUNCIÓN: Top vacantes por conversión
-- =====================================================
CREATE OR REPLACE FUNCTION fn_top_vacantes_conversion(
  p_organization_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  vacante_id UUID,
  titulo VARCHAR,
  total_aplicaciones BIGINT,
  contratados BIGINT,
  tasa_conversion NUMERIC,
  score_promedio NUMERIC,
  dias_abierta NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.titulo,
    COUNT(a.id)                                             AS total_aplicaciones,
    COUNT(a.id) FILTER (WHERE a.estado = 'contratado')     AS contratados,
    ROUND(
      COUNT(a.id) FILTER (WHERE a.estado = 'contratado')::numeric /
      NULLIF(COUNT(a.id), 0) * 100, 1
    )                                                       AS tasa_conversion,
    ROUND(AVG(a.score_final)::numeric, 1)                  AS score_promedio,
    ROUND(
      EXTRACT(EPOCH FROM (COALESCE(v.updated_at, NOW()) - v.created_at)) / 86400
    , 1)                                                    AS dias_abierta
  FROM vacantes v
  LEFT JOIN aplicaciones a ON a.vacante_id = v.id
  WHERE v.organization_id = p_organization_id
  GROUP BY v.id, v.titulo, v.created_at, v.updated_at
  ORDER BY total_aplicaciones DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ÍNDICES para optimizar queries de reportes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_aplicaciones_created_at ON aplicaciones(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aplicaciones_estado_org ON aplicaciones(organization_id, estado);
CREATE INDEX IF NOT EXISTS idx_aplicaciones_updated_at ON aplicaciones(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vacantes_estado_org ON vacantes(organization_id, estado);
CREATE INDEX IF NOT EXISTS idx_contratos_estado_org ON contratos(organization_id, estado);
