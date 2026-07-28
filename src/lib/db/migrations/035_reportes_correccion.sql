-- 035: Correccion de las vistas de reportes
--
-- PROBLEMA 1 — v_kpis_generales era un producto cartesiano
-- Los seis LEFT JOIN colgaban todos de organizations.id sin relacion entre si,
-- de modo que el resultado intermedio era
--   |vacantes| x |candidatos| x |aplicaciones| x |entrevistas_ia| x
--   |entrevistas_humanas| x |contratos|
-- por organizacion. Con 20 vacantes / 300 candidatos / 300 aplicaciones / 100
-- entrevistas, el plan estimaba 1.500.000.000 de filas y la consulta no
-- terminaba en mas de 120 segundos. Las rutas que la usan declaran
-- maxDuration 10 y 60, asi que en produccion devolvian 504 en cuanto un cliente
-- tuviera datos reales. Los COUNT(DISTINCT ...) daban el numero correcto — el
-- fallo era de rendimiento, no de exactitud.
--
-- Se reescribe con subconsultas agregadas independientes por tabla: cada una
-- recorre su tabla una sola vez y no multiplica a las demas.
--
-- PROBLEMA 2 — v_tiempos_por_etapa si sesgaba las medias
-- Aqui los LEFT JOIN si son por fila (ON ...aplicacion_id = a.id), asi que una
-- aplicacion con N evaluaciones se replicaba N veces y pesaba N en el AVG. Con
-- dos aplicaciones (2 y 10 dias) y 3 evaluaciones en la segunda, la media real
-- de 6.0 dias se reportaba como 8.0 — un 33% de sobreestimacion, y el sesgo
-- crece cuanto mas completo es el proceso de un candidato.
--
-- Se agrega cada sub-entidad por aplicacion (min de su fecha) ANTES de unir.
--
-- PROBLEMA 3 — contratados_90d usaba updated_at
-- `updated_at` se toca al editar cualquier campo, asi que una contratacion de
-- hace 200 dias volvia a contar como reciente en cuanto alguien añadia una nota.
-- Se usa `seleccionado_at`, que si es una marca de evento, con updated_at como
-- respaldo para filas antiguas.
--
-- Idempotente: CREATE OR REPLACE.

-- ── 1. KPIs generales, sin producto cartesiano ───────────────────────────────
CREATE OR REPLACE VIEW v_kpis_generales AS
SELECT
  o.id   AS organization_id,
  o.name AS organization_name,

  COALESCE(vac.vacantes_activas, 0)      AS vacantes_activas,
  COALESCE(vac.vacantes_cerradas_30d, 0) AS vacantes_cerradas_30d,

  COALESCE(cand.total_candidatos, 0)  AS total_candidatos,
  COALESCE(apl.total_aplicaciones, 0) AS total_aplicaciones,
  COALESCE(apl.total_contratados, 0)  AS total_contratados,
  COALESCE(apl.aplicaciones_90d, 0)   AS aplicaciones_90d,
  COALESCE(apl.contratados_90d, 0)    AS contratados_90d,

  apl.score_ats_promedio,
  apl.score_ia_promedio,
  apl.score_humano_promedio,
  apl.score_tecnico_promedio,
  apl.score_final_promedio,

  COALESCE(eia.entrevistas_ia_completadas, 0)      AS entrevistas_ia_completadas,
  COALESCE(ehu.entrevistas_humanas_completadas, 0) AS entrevistas_humanas_completadas,
  COALESCE(ctr.contratos_firmados, 0)              AS contratos_firmados

FROM organizations o

LEFT JOIN (
  SELECT organization_id,
         COUNT(*) FILTER (WHERE estado = 'publicada') AS vacantes_activas,
         COUNT(*) FILTER (WHERE estado = 'cerrada'
           AND updated_at >= NOW() - INTERVAL '30 days') AS vacantes_cerradas_30d
  FROM vacantes GROUP BY organization_id
) vac ON vac.organization_id = o.id

LEFT JOIN (
  SELECT organization_id, COUNT(*) AS total_candidatos
  FROM candidatos GROUP BY organization_id
) cand ON cand.organization_id = o.id

LEFT JOIN (
  SELECT organization_id,
         COUNT(*)                                        AS total_aplicaciones,
         COUNT(*) FILTER (WHERE estado = 'contratado')   AS total_contratados,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '90 days') AS aplicaciones_90d,
         -- Cohorte por fecha de evento, no por updated_at.
         COUNT(*) FILTER (
           WHERE estado = 'contratado'
             AND COALESCE(seleccionado_at, updated_at) >= NOW() - INTERVAL '90 days'
         )                                               AS contratados_90d,
         ROUND(AVG(score_ats)::numeric, 1)               AS score_ats_promedio,
         ROUND(AVG(score_ia)::numeric, 1)                AS score_ia_promedio,
         ROUND(AVG(score_humano)::numeric, 1)            AS score_humano_promedio,
         ROUND(AVG(score_tecnico)::numeric, 1)           AS score_tecnico_promedio,
         ROUND(AVG(score_final)::numeric, 1)             AS score_final_promedio
  FROM aplicaciones GROUP BY organization_id
) apl ON apl.organization_id = o.id

LEFT JOIN (
  SELECT organization_id, COUNT(*) FILTER (WHERE estado = 'completada') AS entrevistas_ia_completadas
  FROM entrevistas_ia GROUP BY organization_id
) eia ON eia.organization_id = o.id

LEFT JOIN (
  -- La aplicacion marca las entrevistas humanas como 'realizada'
  -- (scoring-dual.service.ts); contar 'completada' dejaba este KPI en 0 para
  -- siempre. Se aceptan ambos por compatibilidad con datos historicos.
  SELECT organization_id,
         COUNT(*) FILTER (WHERE estado IN ('realizada', 'completada')) AS entrevistas_humanas_completadas
  FROM entrevistas_humanas GROUP BY organization_id
) ehu ON ehu.organization_id = o.id

LEFT JOIN (
  SELECT organization_id, COUNT(*) FILTER (WHERE estado = 'firmado') AS contratos_firmados
  FROM contratos GROUP BY organization_id
) ctr ON ctr.organization_id = o.id;

-- ── 2. Tiempos por etapa, una fila por aplicacion ────────────────────────────
CREATE OR REPLACE VIEW v_tiempos_por_etapa AS
WITH transiciones AS (
  SELECT
    a.organization_id,
    a.id AS aplicacion_id,
    a.created_at AS fecha_aplicacion,
    -- Cada sub-entidad se agrega ANTES de unir: sin esto, una aplicacion con
    -- varias evaluaciones se replicaba y pesaba de mas en todas las medias.
    (SELECT MIN(ei.created_at) FROM entrevistas_ia ei      WHERE ei.aplicacion_id = a.id) AS fecha_entrevista_ia,
    (SELECT MIN(eh.created_at) FROM entrevistas_humanas eh WHERE eh.aplicacion_id = a.id) AS fecha_entrevista_humana,
    (SELECT MIN(ev.created_at) FROM evaluaciones ev        WHERE ev.aplicacion_id = a.id) AS fecha_evaluacion,
    CASE WHEN a.estado = 'contratado' THEN COALESCE(a.seleccionado_at, a.updated_at) END AS fecha_contratacion
  FROM aplicaciones a
)
SELECT
  organization_id,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (fecha_entrevista_ia - fecha_aplicacion)) / 86400
  )::numeric, 1) AS dias_aplicacion_a_entrevista_ia,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (fecha_entrevista_humana - fecha_entrevista_ia)) / 86400
  )::numeric, 1) AS dias_entrevista_ia_a_humana,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (fecha_evaluacion - fecha_entrevista_humana)) / 86400
  )::numeric, 1) AS dias_humana_a_evaluacion,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (fecha_contratacion - fecha_aplicacion)) / 86400
  )::numeric, 1) AS dias_total_contratacion,
  COUNT(*) FILTER (WHERE fecha_contratacion IS NOT NULL) AS contrataciones_completadas
FROM transiciones
GROUP BY organization_id;

-- Indices de apoyo para las subconsultas por aplicacion.
CREATE INDEX IF NOT EXISTS idx_entrevistas_ia_aplicacion      ON entrevistas_ia(aplicacion_id);
CREATE INDEX IF NOT EXISTS idx_entrevistas_humanas_aplicacion ON entrevistas_humanas(aplicacion_id);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_aplicacion        ON evaluaciones(aplicacion_id);
