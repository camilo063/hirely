-- Hirely: Tracking de errores de scoring ATS
-- Permite al admin saber que candidatos necesitan re-scoring manual
-- y cuantos intentos de scoring se han hecho.

ALTER TABLE aplicaciones
  ADD COLUMN IF NOT EXISTS score_ats_error TEXT;

ALTER TABLE aplicaciones
  ADD COLUMN IF NOT EXISTS score_ats_intentos INTEGER DEFAULT 0;

-- Indice para encontrar rapido aplicaciones que necesitan re-scoring
CREATE INDEX IF NOT EXISTS idx_aplicaciones_score_pendiente
  ON aplicaciones (vacante_id)
  WHERE score_ats IS NULL;
