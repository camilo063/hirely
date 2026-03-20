-- S7: Configurable admin email for firma + email templates config
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS email_firma_admin VARCHAR(255);
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS email_seleccion_body TEXT;
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS email_rechazo_body TEXT;
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS email_onboarding_body TEXT;
