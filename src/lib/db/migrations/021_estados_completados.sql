ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS estados_completados TEXT[] DEFAULT '{}';
