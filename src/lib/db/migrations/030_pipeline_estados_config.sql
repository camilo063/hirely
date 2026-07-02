-- 030: Configuracion de estados del pipeline por organizacion
--
-- El catalogo de estados (keys, colores, prerequisitos, descripcion) es fijo y
-- vive en codigo (src/lib/constants/pipeline-states.ts). Esta tabla solo guarda
-- OVERRIDES por organizacion: label (renombrar), orden (reordenar) y activo
-- (activar/desactivar). No agrega ni quita estados del catalogo.

CREATE TABLE IF NOT EXISTS pipeline_estados_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  estado_key VARCHAR(50) NOT NULL,
  label VARCHAR(100),
  orden INTEGER,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, estado_key)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_estados_config_org ON pipeline_estados_config(organization_id);
