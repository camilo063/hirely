-- Migration 007: Add scoring breakdown columns to aplicaciones
-- Stores detailed score breakdown per dimension for the ATS scoring engine

ALTER TABLE aplicaciones ADD COLUMN score_ats_breakdown JSONB DEFAULT '{}';
ALTER TABLE aplicaciones ADD COLUMN score_ats_resumen TEXT;
ALTER TABLE aplicaciones ADD COLUMN scored_at TIMESTAMPTZ;

-- Index for ranking by score within a vacancy
CREATE INDEX IF NOT EXISTS idx_aplicaciones_score_ats ON aplicaciones(vacante_id, score_ats DESC NULLS LAST);
