-- 029: Umbral de preseleccion ATS a nivel organizacion
--
-- Contexto: la pantalla Configuracion > Scoring mostraba un campo "Umbral de
-- preseleccion ATS (%)" que nunca se persistia ni se usaba. El corte real se
-- resolvia siempre con vacantes.score_minimo, y donde no habia valor caia al
-- literal 70 hardcodeado. Esta migracion:
--   1. Agrega la columna donde vive el umbral por organizacion.
--   2. Convierte score_minimo en "override opcional": las vacantes que tenian
--      el default historico (70) pasan a NULL para heredar el umbral de la org.
--
-- Umbral efectivo = COALESCE(vacante.score_minimo, org_settings.umbral_preseleccion, 70)

-- 1. Umbral por organizacion (default 70, el mismo valor que antes estaba hardcodeado)
ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS umbral_preseleccion NUMERIC(5,2) DEFAULT 70;

-- 2. score_minimo pasa a ser un override opcional por vacante (NULL = heredar de la org)
ALTER TABLE vacantes ALTER COLUMN score_minimo DROP DEFAULT;
ALTER TABLE vacantes ALTER COLUMN score_minimo DROP NOT NULL;

-- 3. Nulificar los 70 legacy (default historico no tocado) para que hereden el umbral de la org.
--    Las vacantes con un valor distinto de 70 se consideran overrides reales y se conservan.
UPDATE vacantes SET score_minimo = NULL WHERE score_minimo = 70;
