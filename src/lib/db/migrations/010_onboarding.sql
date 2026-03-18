-- Migration 010: Onboarding y Bienvenida
-- Tabla de onboarding por candidato contratado

CREATE TABLE IF NOT EXISTS onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aplicacion_id UUID REFERENCES aplicaciones(id) NOT NULL UNIQUE,
  candidato_id UUID REFERENCES candidatos(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  fecha_inicio DATE NOT NULL,
  email_bienvenida_estado VARCHAR(50) DEFAULT 'pendiente',
  email_bienvenida_programado_at TIMESTAMPTZ,
  email_bienvenida_enviado_at TIMESTAMPTZ,
  variables_custom JSONB DEFAULT '{}',
  notas_onboarding TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documentos de onboarding por organización
CREATE TABLE IF NOT EXISTS documentos_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  url TEXT NOT NULL,
  tipo VARCHAR(50) DEFAULT 'pdf',
  orden INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar campos de onboarding a org_settings
ALTER TABLE org_settings ADD COLUMN onboarding_plantilla TEXT;
ALTER TABLE org_settings ADD COLUMN onboarding_asunto VARCHAR(500);
ALTER TABLE org_settings ADD COLUMN onboarding_remitente_nombre VARCHAR(255);

-- Índices
CREATE INDEX IF NOT EXISTS idx_onboarding_aplicacion ON onboarding(aplicacion_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_org ON onboarding(organization_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_fecha ON onboarding(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_onboarding_email_estado ON onboarding(email_bienvenida_estado);
CREATE INDEX IF NOT EXISTS idx_docs_onboarding_org ON documentos_onboarding(organization_id);
