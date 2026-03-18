-- =====================================================
-- GOOGLE OAUTH TOKENS (Calendar + futuro Drive/Sign)
-- =====================================================
CREATE TABLE IF NOT EXISTS google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Tokens OAuth
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Scopes otorgados
  scopes TEXT[] NOT NULL DEFAULT '{}',

  -- Cuenta Google conectada
  google_account_email VARCHAR(255),
  google_account_name VARCHAR(255),

  -- Estado
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_google_tokens_org ON google_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_google_tokens_user ON google_tokens(user_id);

-- =====================================================
-- EVENTOS DE CALENDAR VINCULADOS A ENTREVISTAS
-- =====================================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  entrevista_id UUID NOT NULL REFERENCES entrevistas_humanas(id) ON DELETE CASCADE,

  -- Datos del evento en Google Calendar
  google_event_id VARCHAR(255) NOT NULL,
  calendar_id VARCHAR(255) DEFAULT 'primary',

  -- Links
  html_link TEXT,
  hangout_link TEXT,

  -- Estado de sync
  status VARCHAR(50) DEFAULT 'confirmed',
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(entrevista_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_entrevista ON calendar_events(entrevista_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_id ON calendar_events(google_event_id);

-- =====================================================
-- AGREGAR COLUMNAS EN entrevistas_humanas
-- =====================================================
ALTER TABLE entrevistas_humanas
  ADD COLUMN IF NOT EXISTS meet_link TEXT;
