-- Migracion: Sistema de Notificaciones
-- Todas las operaciones usan IF NOT EXISTS para idempotencia

-- =============================================
-- TABLA: notificaciones
-- =============================================
CREATE TABLE IF NOT EXISTS notificaciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  usuario_id      UUID REFERENCES users(id) ON DELETE SET NULL,

  tipo            VARCHAR(80) NOT NULL,
  titulo          VARCHAR(200) NOT NULL,
  mensaje         TEXT NOT NULL,
  leida           BOOLEAN NOT NULL DEFAULT FALSE,

  meta            JSONB DEFAULT '{}'::jsonb,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  leida_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_org_leida
  ON notificaciones (organization_id, leida, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificaciones_org_tipo
  ON notificaciones (organization_id, tipo, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario
  ON notificaciones (usuario_id, leida, created_at DESC);

-- =============================================
-- TABLA: notificacion_config
-- =============================================
CREATE TABLE IF NOT EXISTS notificacion_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  tipo            VARCHAR(80) NOT NULL,

  inapp_activo    BOOLEAN NOT NULL DEFAULT TRUE,
  browser_activo  BOOLEAN NOT NULL DEFAULT FALSE,
  prioridad       VARCHAR(10) NOT NULL DEFAULT 'media',

  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (organization_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_notificacion_config_org
  ON notificacion_config (organization_id);
