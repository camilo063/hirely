-- 036: Que la configuracion de pesos de scoring de la organizacion se aplique
--
-- PROBLEMA QUE RESUELVE
-- `scoring-dual.service.ts` resuelve los pesos con
--   COALESCE(a.peso_ia, os.peso_ia / 100.0)
-- para que la configuracion de la organizacion (Configuracion > Scoring, que
-- guarda 40/60) sirva de respaldo cuando la aplicacion no tiene pesos propios.
--
-- Pero `aplicaciones.peso_ia` y `peso_humano` tienen DEFAULT 0.50, asi que NUNCA
-- son NULL: el COALESCE cortaba siempre en 0.50 y la configuracion de la empresa
-- no se aplicaba jamas. Era una pantalla que guardaba un valor que nadie leia.
--
-- Ningun codigo de produccion escribe estas columnas (solo el seed), asi que se
-- retira el DEFAULT y se ponen a NULL las filas que conservan exactamente el
-- valor por defecto: a partir de ahi el respaldo de organizacion entra en juego.
-- Una aplicacion con pesos propios distintos de 0.50 (puestos a mano) se respeta.
--
-- Idempotente.

ALTER TABLE aplicaciones ALTER COLUMN peso_ia     DROP DEFAULT;
ALTER TABLE aplicaciones ALTER COLUMN peso_humano DROP DEFAULT;

UPDATE aplicaciones
SET peso_ia = NULL, peso_humano = NULL
WHERE peso_ia = 0.50 AND peso_humano = 0.50;
