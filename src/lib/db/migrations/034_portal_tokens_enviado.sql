-- 034: Marca de envio confirmado en los tokens de portal
--
-- PROBLEMA QUE RESUELVE
-- El freno anti-repeticion de la renovacion de links se calculaba sobre la
-- FECHA DE EMISION del token. Si el correo fallaba, el token quedaba creado
-- igualmente y durante los 10 minutos siguientes el candidato recibia el mensaje
-- "ya enviamos un link, revisa tu correo" sobre un mensaje que nunca salio: un
-- callejon sin salida que se repetia indefinidamente.
--
-- Con esta columna el freno se mide sobre envios REALMENTE confirmados, y el
-- token que no se pudo anunciar se descarta.
--
-- Idempotente.

ALTER TABLE portal_tokens ADD COLUMN IF NOT EXISTS enviado_at TIMESTAMPTZ;

-- Backfill: los tokens que ya existen se consideran anunciados (llegaron al
-- candidato por el email de seleccion), para no reabrir el freno de golpe.
UPDATE portal_tokens
SET enviado_at = created_at
WHERE enviado_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_portal_tokens_enviados
  ON portal_tokens(aplicacion_id, enviado_at)
  WHERE enviado_at IS NOT NULL;
