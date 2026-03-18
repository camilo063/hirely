-- Agregar columna de seguridad a evaluaciones
ALTER TABLE evaluaciones
ADD COLUMN IF NOT EXISTS eventos_seguridad JSONB DEFAULT '[]';

-- Índice GIN para consultas por tipo de evento
CREATE INDEX IF NOT EXISTS idx_evaluaciones_seguridad
ON evaluaciones USING GIN(eventos_seguridad);
