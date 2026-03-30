-- Migracion 026: Checklist de onboarding inicial para nuevas organizaciones
-- Idempotente: usa IF NOT EXISTS en todo

CREATE TABLE IF NOT EXISTS onboarding_checklist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  paso            VARCHAR(50) NOT NULL,
  completado      BOOLEAN NOT NULL DEFAULT false,
  completado_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, paso)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_checklist_org
  ON onboarding_checklist(organization_id);
