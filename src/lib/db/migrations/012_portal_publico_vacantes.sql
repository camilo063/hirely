-- Migration 012: Portal Público de Vacantes
-- Adds public portal support: slugs, publishing, view tracking, org portal settings

-- Vacantes: slug y publicación
ALTER TABLE vacantes ADD COLUMN slug VARCHAR(255);
ALTER TABLE vacantes ADD COLUMN is_published BOOLEAN DEFAULT false;
ALTER TABLE vacantes ADD COLUMN published_at TIMESTAMPTZ;
ALTER TABLE vacantes ADD COLUMN views_count INTEGER DEFAULT 0;
ALTER TABLE vacantes ADD COLUMN applications_count INTEGER DEFAULT 0;

-- Índice único para slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_vacantes_slug ON vacantes(slug) WHERE slug IS NOT NULL;

-- Índice para listado público
CREATE INDEX IF NOT EXISTS idx_vacantes_publicadas ON vacantes(organization_id, is_published, estado);

-- Aplicaciones: tracking de fuente
ALTER TABLE aplicaciones ADD COLUMN referrer_url TEXT;
ALTER TABLE aplicaciones ADD COLUMN ip_address VARCHAR(50);

-- Configuración del portal público por organización
ALTER TABLE org_settings ADD COLUMN portal_logo_url TEXT;
ALTER TABLE org_settings ADD COLUMN portal_color_primario VARCHAR(7) DEFAULT '#00BCD4';
ALTER TABLE org_settings ADD COLUMN portal_descripcion TEXT;
ALTER TABLE org_settings ADD COLUMN portal_website TEXT;

-- Marcar vacantes publicadas existentes
UPDATE vacantes SET is_published = true, published_at = created_at WHERE estado = 'publicada';
