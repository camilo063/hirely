-- Hirely: Contratos, Plantillas, Activity Log, Settings

-- Contratos
CREATE TABLE IF NOT EXISTS contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aplicacion_id UUID REFERENCES aplicaciones(id),
  tipo VARCHAR(50) NOT NULL,
  plantilla_id UUID,
  datos_contrato JSONB DEFAULT '{}',
  contenido_html TEXT,
  pdf_url TEXT,
  estado VARCHAR(50) DEFAULT 'borrador',
  docusign_envelope_id VARCHAR(255),
  firmado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plantillas de contrato
CREATE TABLE IF NOT EXISTS plantillas_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  contenido_html TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de actividad (auditoria)
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuraciones de organizacion
CREATE TABLE IF NOT EXISTS org_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) UNIQUE,
  email_remitente VARCHAR(255),
  email_bienvenida_plantilla TEXT,
  email_seleccion_plantilla TEXT,
  email_rechazo_plantilla TEXT,
  checklist_documentos JSONB DEFAULT '[]',
  scoring_pesos_default JSONB DEFAULT '{"experiencia": 0.30, "habilidades": 0.25, "educacion": 0.15, "idiomas": 0.15, "certificaciones": 0.10, "keywords": 0.05}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_vacantes_org ON vacantes(organization_id);
CREATE INDEX IF NOT EXISTS idx_vacantes_estado ON vacantes(estado);
CREATE INDEX IF NOT EXISTS idx_candidatos_org ON candidatos(organization_id);
CREATE INDEX IF NOT EXISTS idx_candidatos_email ON candidatos(email);
CREATE INDEX IF NOT EXISTS idx_aplicaciones_vacante ON aplicaciones(vacante_id);
CREATE INDEX IF NOT EXISTS idx_aplicaciones_candidato ON aplicaciones(candidato_id);
CREATE INDEX IF NOT EXISTS idx_aplicaciones_estado ON aplicaciones(estado);
CREATE INDEX IF NOT EXISTS idx_activity_log_org ON activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
