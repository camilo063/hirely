-- Migration 005: LinkedIn OAuth Integration
-- Stores OAuth tokens and post audit log

CREATE TABLE IF NOT EXISTS linkedin_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    refresh_token TEXT,
    refresh_token_expires_at TIMESTAMPTZ,
    linkedin_sub TEXT NOT NULL,
    linkedin_name TEXT,
    linkedin_email TEXT,
    linkedin_picture TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS linkedin_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vacante_id UUID NOT NULL REFERENCES vacantes(id) ON DELETE CASCADE,
    linkedin_post_id TEXT,
    content TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'PUBLIC',
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_linkedin_tokens_org_user ON linkedin_tokens(organization_id, user_id);
CREATE INDEX idx_linkedin_posts_vacante ON linkedin_posts(vacante_id);
CREATE INDEX idx_linkedin_posts_org ON linkedin_posts(organization_id);
