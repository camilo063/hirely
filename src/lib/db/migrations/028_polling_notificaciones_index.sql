-- Migracion: optimizar polling de notificaciones
-- Reemplaza el modelo SSE por polling cada 20s desde el cliente.
-- La query principal del polling filtra por organization_id y created_at > $desde,
-- sin tocar leida — los indices anteriores tenian `leida` en medio y eran subóptimos.

CREATE INDEX IF NOT EXISTS idx_notificaciones_org_created
  ON notificaciones (organization_id, created_at DESC);

-- Indice parcial para el conteo rapido de no leidas (se ejecuta en cada poll).
CREATE INDEX IF NOT EXISTS idx_notificaciones_org_no_leidas
  ON notificaciones (organization_id) WHERE leida = false;
