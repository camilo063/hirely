-- =====================================================
-- VISTA: Analisis de integridad por evaluacion
-- Cada evento en eventos_seguridad es un objeto individual
-- {tipo: "cambio_pestana"|"intento_copia", timestamp: "ISO"}
-- =====================================================
CREATE OR REPLACE VIEW v_integridad_evaluaciones AS
WITH eventos_expandidos AS (
  SELECT
    e.id                                                AS evaluacion_id,
    e.organization_id,
    e.candidato_id,
    e.vacante_id,
    e.estado,
    e.score_total,
    e.aprobada,
    e.completada_at,
    e.created_at,

    -- Contar eventos de cambio de pestana
    COALESCE(
      (SELECT COUNT(*)
       FROM jsonb_array_elements(e.eventos_seguridad) AS ev
       WHERE ev->>'tipo' = 'cambio_pestana'),
      0
    )::int                                              AS cambios_pestana,

    -- Contar eventos de intento de copia
    COALESCE(
      (SELECT COUNT(*)
       FROM jsonb_array_elements(e.eventos_seguridad) AS ev
       WHERE ev->>'tipo' = 'intento_copia'),
      0
    )::int                                              AS intentos_copia,

    COALESCE(jsonb_array_length(e.eventos_seguridad), 0) AS total_eventos

  FROM evaluaciones e
  WHERE e.estado = 'completada'
    AND e.eventos_seguridad IS NOT NULL
),
clasificacion AS (
  SELECT
    *,
    LEAST(
      ROUND(
        (cambios_pestana * 10 + intentos_copia * 20)::numeric,
        0
      ),
      100
    )::int                                              AS score_riesgo,

    CASE
      WHEN cambios_pestana >= 5 OR intentos_copia >= 3 THEN 'alto'
      WHEN cambios_pestana >= 3 OR intentos_copia >= 1 THEN 'medio'
      WHEN cambios_pestana >= 1 THEN 'bajo'
      ELSE 'sin_incidentes'
    END                                                 AS nivel_riesgo

  FROM eventos_expandidos
)
SELECT
  cl.*,
  CONCAT(c.nombre, ' ', COALESCE(c.apellido, ''))       AS candidato_nombre,
  c.email                                               AS candidato_email,
  v.titulo                                              AS vacante_titulo
FROM clasificacion cl
JOIN candidatos c  ON c.id = cl.candidato_id
JOIN vacantes   v  ON v.id = cl.vacante_id;

-- =====================================================
-- VISTA: KPIs de integridad por organizacion
-- =====================================================
CREATE OR REPLACE VIEW v_kpis_integridad AS
SELECT
  organization_id,

  COUNT(*)                                              AS total_evaluaciones_completadas,
  COUNT(*) FILTER (WHERE nivel_riesgo = 'sin_incidentes') AS evaluaciones_limpias,
  COUNT(*) FILTER (WHERE nivel_riesgo = 'bajo')         AS riesgo_bajo,
  COUNT(*) FILTER (WHERE nivel_riesgo = 'medio')        AS riesgo_medio,
  COUNT(*) FILTER (WHERE nivel_riesgo = 'alto')         AS riesgo_alto,

  ROUND(
    COUNT(*) FILTER (WHERE nivel_riesgo != 'sin_incidentes')::numeric
    / NULLIF(COUNT(*), 0) * 100,
    1
  )                                                     AS pct_con_incidentes,

  SUM(cambios_pestana)                                  AS total_cambios_pestana,
  SUM(intentos_copia)                                   AS total_intentos_copia,

  ROUND(AVG(cambios_pestana)::numeric, 1)               AS promedio_cambios_pestana,
  ROUND(AVG(intentos_copia)::numeric, 1)                AS promedio_intentos_copia,
  ROUND(AVG(score_riesgo)::numeric, 1)                  AS score_riesgo_promedio,

  ROUND(AVG(score_total) FILTER (WHERE nivel_riesgo = 'alto')::numeric, 1)
                                                        AS score_promedio_riesgo_alto,
  ROUND(AVG(score_total) FILTER (WHERE nivel_riesgo = 'sin_incidentes')::numeric, 1)
                                                        AS score_promedio_sin_incidentes

FROM v_integridad_evaluaciones
GROUP BY organization_id;

-- =====================================================
-- VISTA: Distribucion de incidentes (para histograma)
-- =====================================================
CREATE OR REPLACE VIEW v_distribucion_incidentes AS
SELECT
  organization_id,
  CASE
    WHEN cambios_pestana + intentos_copia = 0           THEN '0 eventos'
    WHEN cambios_pestana + intentos_copia BETWEEN 1 AND 2 THEN '1-2 eventos'
    WHEN cambios_pestana + intentos_copia BETWEEN 3 AND 5 THEN '3-5 eventos'
    ELSE '6+ eventos'
  END                                                   AS rango_eventos,
  COUNT(*)                                              AS cantidad_evaluaciones
FROM v_integridad_evaluaciones
GROUP BY organization_id,
  CASE
    WHEN cambios_pestana + intentos_copia = 0           THEN '0 eventos'
    WHEN cambios_pestana + intentos_copia BETWEEN 1 AND 2 THEN '1-2 eventos'
    WHEN cambios_pestana + intentos_copia BETWEEN 3 AND 5 THEN '3-5 eventos'
    ELSE '6+ eventos'
  END;
