-- Hirely: Add missing columns needed by services

-- Vacantes: add departamento
ALTER TABLE vacantes ADD COLUMN IF NOT EXISTS departamento VARCHAR(100);

-- Candidatos: add apellido, salario_esperado, notas
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS apellido VARCHAR(255) DEFAULT '';
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS salario_esperado NUMERIC(12,2);
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS notas TEXT;

-- Aplicaciones: add organization_id, notas_internas, motivo_descarte
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS notas_internas TEXT;
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS motivo_descarte TEXT;

-- Entrevistas IA: add organization_id, candidato_id, vacante_id, updated_at, and rename columns
ALTER TABLE entrevistas_ia ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE entrevistas_ia ADD COLUMN IF NOT EXISTS candidato_id UUID REFERENCES candidatos(id);
ALTER TABLE entrevistas_ia ADD COLUMN IF NOT EXISTS vacante_id UUID REFERENCES vacantes(id);
ALTER TABLE entrevistas_ia ADD COLUMN IF NOT EXISTS score NUMERIC(5,2);
ALTER TABLE entrevistas_ia ADD COLUMN IF NOT EXISTS duracion_minutos INTEGER;
ALTER TABLE entrevistas_ia ADD COLUMN IF NOT EXISTS dapta_session_id VARCHAR(255);
ALTER TABLE entrevistas_ia ADD COLUMN IF NOT EXISTS dapta_call_url TEXT;
ALTER TABLE entrevistas_ia ADD COLUMN IF NOT EXISTS fecha_completada TIMESTAMPTZ;
ALTER TABLE entrevistas_ia ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Entrevistas Humanas: add organization_id, candidato_id, vacante_id, notas, score, updated_at
ALTER TABLE entrevistas_humanas ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE entrevistas_humanas ADD COLUMN IF NOT EXISTS candidato_id UUID REFERENCES candidatos(id);
ALTER TABLE entrevistas_humanas ADD COLUMN IF NOT EXISTS vacante_id UUID REFERENCES vacantes(id);
ALTER TABLE entrevistas_humanas ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE entrevistas_humanas ADD COLUMN IF NOT EXISTS score NUMERIC(5,2);
ALTER TABLE entrevistas_humanas ADD COLUMN IF NOT EXISTS fecha_completada TIMESTAMPTZ;
ALTER TABLE entrevistas_humanas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Contratos: add organization_id, candidato_id, vacante_id, created_by, datos (alias for datos_contrato), html_content (alias)
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS candidato_id UUID REFERENCES candidatos(id);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS vacante_id UUID REFERENCES vacantes(id);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Org settings: add peso_ia, peso_humano for scoring
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS peso_ia NUMERIC(5,2) DEFAULT 40;
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS peso_humano NUMERIC(5,2) DEFAULT 60;

-- Backfill organization_id on aplicaciones from vacantes
UPDATE aplicaciones SET organization_id = v.organization_id
FROM vacantes v WHERE aplicaciones.vacante_id = v.id AND aplicaciones.organization_id IS NULL;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_aplicaciones_org ON aplicaciones(organization_id);
CREATE INDEX IF NOT EXISTS idx_entrevistas_ia_org ON entrevistas_ia(organization_id);
CREATE INDEX IF NOT EXISTS idx_entrevistas_humanas_org ON entrevistas_humanas(organization_id);
CREATE INDEX IF NOT EXISTS idx_contratos_org ON contratos(organization_id);
