-- 023: Configuracion global de empresa contratante
-- Datos transversales para todos los contratos (NIT, representante legal, etc.)

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS config_empresa JSONB DEFAULT '{}';

-- Estructura esperada de config_empresa:
-- {
--   "nit": "900.123.456-7",
--   "representante_legal": "Juan Carlos Pérez",
--   "cargo_representante": "Gerente General",
--   "direccion": "Cra 15 #93-75 Of 301",
--   "ciudad": "Bogotá",
--   "departamento": "Cundinamarca",
--   "pais": "Colombia",
--   "telefono_empresa": "+57 601 234 5678",
--   "email_empresa": "contratos@empresa.com"
-- }

COMMENT ON COLUMN organizations.config_empresa IS 'Datos globales de la empresa contratante para contratos';
