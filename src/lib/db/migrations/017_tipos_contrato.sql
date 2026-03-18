-- Migration 017: Dynamic contract types per organization
CREATE TABLE IF NOT EXISTS tipos_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  descripcion TEXT,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_tipos_contrato_org ON tipos_contrato(organization_id);
CREATE INDEX IF NOT EXISTS idx_tipos_contrato_active ON tipos_contrato(organization_id, is_active);

-- Seed default types for all existing organizations
INSERT INTO tipos_contrato (organization_id, nombre, slug, descripcion, is_system)
SELECT o.id, t.nombre, t.slug, t.descripcion, true
FROM organizations o
CROSS JOIN (VALUES
  ('Indefinido', 'indefinido', 'Contrato a termino indefinido'),
  ('Termino Fijo', 'termino_fijo', 'Contrato a termino fijo'),
  ('Prestacion de Servicios', 'prestacion_servicios', 'Contrato de prestacion de servicios'),
  ('Obra o Labor', 'obra_labor', 'Contrato por obra o labor determinada'),
  ('Aprendizaje', 'aprendizaje', 'Contrato de aprendizaje')
) AS t(nombre, slug, descripcion)
ON CONFLICT (organization_id, slug) DO NOTHING;
