CREATE TABLE IF NOT EXISTS terminaciones_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aplicacion_id UUID NOT NULL REFERENCES aplicaciones(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  motivo VARCHAR(100) NOT NULL,
  motivo_detalle TEXT,
  fecha_terminacion DATE NOT NULL,
  notas TEXT,
  creado_por UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terminaciones_aplicacion ON terminaciones_contrato(aplicacion_id);
CREATE INDEX IF NOT EXISTS idx_terminaciones_org ON terminaciones_contrato(organization_id);
