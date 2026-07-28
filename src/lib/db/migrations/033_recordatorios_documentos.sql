-- 033: Recordatorios automaticos del portal de documentos
--
-- PROBLEMA QUE RESUELVE
-- El candidato recibia UN solo email al ser seleccionado. Si no subia los
-- documentos, no volvia a saber nada: el proceso quedaba detenido en silencio y
-- el reclutador tenia que acordarse de perseguirlo a mano. Estas columnas
-- permiten que un cron mande recordatorios espaciados sin repetirlos.
--
-- Idempotente.

ALTER TABLE aplicaciones
  ADD COLUMN IF NOT EXISTS documentos_recordatorios_enviados INTEGER NOT NULL DEFAULT 0;

ALTER TABLE aplicaciones
  ADD COLUMN IF NOT EXISTS documentos_ultimo_recordatorio_at TIMESTAMPTZ;

-- Indice para que el cron localice rapido a los candidatos que siguen debiendo
-- documentos, sin escanear toda la tabla de aplicaciones.
CREATE INDEX IF NOT EXISTS idx_aplicaciones_documentos_pendientes
  ON aplicaciones(estado, documentos_ultimo_recordatorio_at)
  WHERE estado = 'documentos_pendientes';
