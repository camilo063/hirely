-- 037: Marca de tiempo dedicada para "cuanto lleva en el estado actual"
--
-- PROBLEMA QUE RESUELVE
-- Para los badges de estancamiento (Fase 2 — visibilidad del reclutador) se
-- necesita saber hace cuanto una aplicacion entro a su estado actual. La unica
-- marca de tiempo existente, `updated_at`, no sirve: la tocan eventos que no
-- son cambios de estado (recalculo de score, flags de documentos, renovacion
-- de portal_token, etc.), asi que no refleja "tiempo en el estado".
--
-- `estado_updated_at` se escribe UNICAMENTE en `transicionarEstado()`
-- (pipeline-transicion.service.ts), el unico punto centralizado que cambia
-- `aplicaciones.estado`.
--
-- Backfill: para filas existentes, `updated_at` es la mejor aproximacion
-- disponible (no hay forma de reconstruir el momento exacto de la ultima
-- transicion real desde el estado actual sin este cambio).
--
-- Idempotente.

ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS estado_updated_at TIMESTAMPTZ;

UPDATE aplicaciones
SET estado_updated_at = updated_at
WHERE estado_updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_aplicaciones_estado_updated_at
  ON aplicaciones(estado_updated_at);
