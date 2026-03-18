-- ============================================================
-- Migration 011: Enhanced Contratos Module
-- Adds version tracking and contract versioning table
-- ============================================================

-- Add version and firma columns to contratos (if not existing)
ALTER TABLE contratos ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE contratos ADD COLUMN firma_provider VARCHAR(50);
ALTER TABLE contratos ADD COLUMN firma_external_id VARCHAR(255);
ALTER TABLE contratos ADD COLUMN firma_url TEXT;

-- Contract versions table
CREATE TABLE IF NOT EXISTS contrato_versiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  contenido_html TEXT,
  datos_contrato JSONB DEFAULT '{}',
  editado_por UUID REFERENCES users(id),
  nota_cambio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_contrato_versiones_contrato ON contrato_versiones(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_estado ON contratos(estado);
CREATE INDEX IF NOT EXISTS idx_contratos_tipo ON contratos(tipo);
CREATE INDEX IF NOT EXISTS idx_contratos_aplicacion ON contratos(aplicacion_id);
