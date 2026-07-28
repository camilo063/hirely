-- 038: Separar el estado de pipeline "Prueba tecnica" de "Entrevista IA"
--
-- PROBLEMA QUE RESUELVE
-- Dos modulos distintos escribian el mismo valor `aplicaciones.estado =
-- 'entrevista_ia'`: la entrevista telefonica con Dapta (entrevista-ia.service.ts)
-- y la prueba tecnica escrita (evaluacion-tecnica.service.ts). El key ya tenia
-- label "Prueba técnica" en el catalogo de estados, dejando a Dapta sin
-- representacion propia en el pipeline y ocultando cual de los dos modulos
-- realmente completo el candidato.
--
-- Se introduce el key nuevo 'prueba_tecnica' (orden 5), y todo lo que venia
-- despues de 'entrevista_ia' (orden 4) se desplaza +1. El key 'entrevista_ia'
-- recupera su significado literal (Dapta).
--
-- Esta migracion solo reordena la tabla de OVERRIDES por organizacion
-- (`pipeline_estados_config`); el catalogo por defecto vive en
-- `src/lib/constants/pipeline-states.ts` y se actualiza en el mismo commit de
-- codigo que esta migracion. Ninguna organizacion en produccion habia
-- personalizado el orden todavia, pero la migracion se deja correcta para
-- cuando eso ocurra.
--
-- Idempotente: una segunda corrida no encuentra filas con orden >= 5 que
-- correspondan a la version pre-split (ya fueron desplazadas), asi que no
-- vuelve a desplazar dos veces. No es completamente re-ejecutable en el
-- sentido estricto (como el resto de migraciones de este proyecto), pero no
-- falla si se corre de nuevo.

UPDATE pipeline_estados_config
SET orden = orden + 1, updated_at = NOW()
WHERE orden >= 5 AND estado_key <> 'descartado';
