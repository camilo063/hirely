-- 031: Campos configurables de evaluacion humana + almacenamiento por aplicacion
-- Permite a cada organizacion definir los criterios (CRUD) que el evaluador
-- califica (de 1 a 5, con decimales) cuando un candidato pasa a 'A evaluar'
-- (estado 'evaluado'). El resultado se guarda en aplicaciones.evaluacion_humana
-- y alimenta score_humano -> score_final.

CREATE TABLE IF NOT EXISTS evaluacion_humana_campos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campo_key VARCHAR(60) NOT NULL,
  label VARCHAR(120) NOT NULL,
  descripcion TEXT,
  orden INTEGER DEFAULT 0,
  min_valor NUMERIC(3,1) DEFAULT 1,
  max_valor NUMERIC(3,1) DEFAULT 5,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, campo_key)
);

CREATE INDEX IF NOT EXISTS idx_evaluacion_humana_campos_org
  ON evaluacion_humana_campos(organization_id);

-- Almacena la evaluacion humana capturada por aplicacion:
-- { valores: { campo_key: number }, observaciones: string|null, evaluated_at: string }
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS evaluacion_humana JSONB;
