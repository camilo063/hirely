-- Migration 009: Selection & Documents Portal
-- Adds portal tokens table, extends documentos_candidato and aplicaciones

-- Tabla de tokens para portal de documentos
CREATE TABLE IF NOT EXISTS portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aplicacion_id UUID REFERENCES aplicaciones(id) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar campos a documentos_candidato
ALTER TABLE documentos_candidato ADD COLUMN nota_rechazo TEXT;
ALTER TABLE documentos_candidato ADD COLUMN verificado_por UUID REFERENCES users(id);
ALTER TABLE documentos_candidato ADD COLUMN verificado_at TIMESTAMPTZ;

-- Agregar campos a aplicaciones para tracking de seleccion
ALTER TABLE aplicaciones ADD COLUMN seleccionado_at TIMESTAMPTZ;
ALTER TABLE aplicaciones ADD COLUMN tipo_contrato VARCHAR(50);
ALTER TABLE aplicaciones ADD COLUMN fecha_inicio_tentativa DATE;
ALTER TABLE aplicaciones ADD COLUMN salario_ofrecido NUMERIC(15,2);
ALTER TABLE aplicaciones ADD COLUMN moneda VARCHAR(10) DEFAULT 'COP';
ALTER TABLE aplicaciones ADD COLUMN documentos_completos BOOLEAN DEFAULT false;
ALTER TABLE aplicaciones ADD COLUMN portal_token VARCHAR(255);

-- Agregar campo checklist personalizado por vacante
ALTER TABLE vacantes ADD COLUMN checklist_documentos JSONB;

-- Indices
CREATE INDEX IF NOT EXISTS idx_documentos_aplicacion ON documentos_candidato(aplicacion_id);
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON documentos_candidato(estado);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_aplicacion ON portal_tokens(aplicacion_id);
