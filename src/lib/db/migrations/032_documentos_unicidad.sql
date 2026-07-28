-- 032: Unicidad de documentos por aplicacion + revocacion de tokens de portal
--
-- PROBLEMA QUE RESUELVE
-- `seleccionarCandidato()` insertaba el checklist completo cada vez que se
-- ejecutaba (mover el pipeline a 'seleccionado' dos veces, reenviar el link,
-- retroceder de 'documentos_pendientes' a 'seleccionado', etc). Como la tabla
-- no tenia ninguna restriccion de unicidad, cada ejecucion duplicaba TODAS las
-- filas del checklist. El candidato veia "Cedula" varias veces (una subida y
-- otra pendiente), volvia a subirla, y el progreso nunca llegaba a 100%.
--
-- Esta migracion consolida los duplicados existentes y hace imposible volver a
-- crearlos. El guard de idempotencia en el servicio depende de esta unicidad
-- (usa ON CONFLICT (aplicacion_id, tipo) DO NOTHING).
--
-- Idempotente: se puede correr varias veces sin efecto adicional.

-- ── 1. Consolidar duplicados existentes ──────────────────────────────────────
-- Por cada (aplicacion_id, tipo) se conserva UNA fila, eligiendo la de mayor
-- valor informativo:
--   1) LA QUE TENGA ARCHIVO. Es el criterio dominante: el archivo es lo unico
--      irrecuperable. Un 'verificado' sin url es basura (una fila de checklist
--      que quedo marcada por error); si ganara, se borraria el archivo real y
--      ademas el portal mostraria el documento como aprobado sin tenerlo.
--   2) estado mas avanzado (verificado > subido > rechazado > pendiente)
--   3) la mas reciente
-- Las demas se eliminan. Ninguna otra tabla referencia documentos_candidato.id,
-- por lo que el borrado no deja huerfanos.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY aplicacion_id, tipo
      ORDER BY
        CASE WHEN url IS NOT NULL AND url <> '' THEN 0 ELSE 1 END,
        CASE estado
          WHEN 'verificado' THEN 1
          WHEN 'subido'     THEN 2
          WHEN 'rechazado'  THEN 3
          ELSE 4
        END,
        created_at DESC
    ) AS rn
  FROM documentos_candidato
  WHERE aplicacion_id IS NOT NULL
)
DELETE FROM documentos_candidato d
USING ranked r
WHERE d.id = r.id
  AND r.rn > 1;

-- ── 2. Impedir que se vuelvan a crear ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documentos_candidato_aplicacion_tipo_key'
  ) THEN
    ALTER TABLE documentos_candidato
      ADD CONSTRAINT documentos_candidato_aplicacion_tipo_key
      UNIQUE (aplicacion_id, tipo);
  END IF;
END $$;

-- ── 3. Trazabilidad de la ultima modificacion del documento ──────────────────
-- Hasta ahora solo existia created_at, que no cambia cuando el candidato
-- reemplaza un archivo. La UI necesita saber cuando se subio la version actual.
ALTER TABLE documentos_candidato ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE documentos_candidato ADD COLUMN IF NOT EXISTS subido_at TIMESTAMPTZ;

-- Backfill: cualquier documento que tenga archivo fue subido en algun momento,
-- incluidos los rechazados (que conservan el archivo que se les objeto).
UPDATE documentos_candidato
SET subido_at = created_at
WHERE subido_at IS NULL
  AND (estado IN ('subido', 'verificado') OR (url IS NOT NULL AND url <> ''));

-- ── 4. Revocacion de tokens de portal ────────────────────────────────────────
-- Antes cada seleccion emitia un token nuevo sin invalidar el anterior, dejando
-- varios links vivos a la vez: el candidato abria uno viejo y veia datos que no
-- correspondian. Ahora se marcan como revocados.
ALTER TABLE portal_tokens ADD COLUMN IF NOT EXISTS revocado_at TIMESTAMPTZ;

-- Revoca los tokens historicos que ya no son el token vigente de la aplicacion.
UPDATE portal_tokens pt
SET revocado_at = NOW()
FROM aplicaciones a
WHERE a.id = pt.aplicacion_id
  AND pt.revocado_at IS NULL
  AND a.portal_token IS NOT NULL
  AND pt.token <> a.portal_token;

CREATE INDEX IF NOT EXISTS idx_portal_tokens_vigentes
  ON portal_tokens(aplicacion_id)
  WHERE revocado_at IS NULL;
