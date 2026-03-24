-- 024: Mapeo explicito tipo_contrato -> plantilla_contrato
-- Permite al admin definir que plantilla usar para cada tipo de contrato

CREATE TABLE IF NOT EXISTS tipo_plantilla_mapeo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  tipo_contrato_slug VARCHAR(100) NOT NULL,
  plantilla_id UUID NOT NULL REFERENCES plantillas_contrato(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, tipo_contrato_slug)
);

CREATE INDEX IF NOT EXISTS idx_tipo_plantilla_mapeo_org ON tipo_plantilla_mapeo(organization_id);
