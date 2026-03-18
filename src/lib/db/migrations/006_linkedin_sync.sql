-- LinkedIn sync tracking columns
ALTER TABLE vacantes ADD COLUMN linkedin_last_sync TIMESTAMPTZ;
ALTER TABLE vacantes ADD COLUMN linkedin_applicants_count INTEGER DEFAULT 0;

-- Origin tracking on aplicaciones
ALTER TABLE aplicaciones ADD COLUMN origen VARCHAR(50) DEFAULT 'manual';

-- Index for finding vacantes with LinkedIn jobs (used by sync/cron)
CREATE INDEX IF NOT EXISTS idx_vacantes_linkedin ON vacantes(linkedin_job_id) WHERE linkedin_job_id IS NOT NULL;
