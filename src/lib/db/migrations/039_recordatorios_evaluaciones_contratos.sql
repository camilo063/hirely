-- 039: Marca de tiempo para detectar contratos estancados en firma
--
-- PROBLEMA QUE RESUELVE
-- `contratos` no tenia ninguna columna que registrara cuando se envio a firma
-- (solo `firmado_at`, que queda NULL mientras el contrato espera). El cron de
-- recordatorios (recordatorios-pipeline) necesita esta marca para detectar
-- contratos que llevan demasiados dias en estado 'enviado' sin firmarse.
--
-- Idempotente.

ALTER TABLE contratos ADD COLUMN IF NOT EXISTS enviado_firma_at TIMESTAMPTZ;
