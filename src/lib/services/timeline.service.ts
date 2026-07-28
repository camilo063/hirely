import { pool } from '@/lib/db';

export interface TimelineEvento {
  entity_type: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  usuario_nombre: string | null;
}

/**
 * Historial cronologico de una aplicacion, leyendo `activity_log`.
 *
 * `activity_log` es polimorfico (`entity_type` + `entity_id`) y no tiene FK
 * directa a `aplicacion_id`: solo los eventos con entity_type='aplicacion'
 * usan el id de la aplicacion directamente. Los demas (evaluacion,
 * entrevista_ia, documento, contrato) requieren resolver la pertenencia a
 * traves de su propia tabla, que si tiene `aplicacion_id`.
 *
 * Acotado ademas por `organization_id` en cada rama como defensa en profundidad:
 * el llamador ya debe haber verificado la aplicacion con `assertAplicacionDeOrg`.
 */
export async function obtenerTimelineAplicacion(
  aplicacionId: string,
  orgId: string
): Promise<TimelineEvento[]> {
  const { rows } = await pool.query<TimelineEvento>(
    `SELECT al.entity_type, al.action, al.details, al.created_at, u.name as usuario_nombre
     FROM activity_log al
     LEFT JOIN users u ON u.id = al.user_id
     WHERE al.organization_id = $1 AND (
       (al.entity_type = 'aplicacion' AND al.entity_id = $2)
       OR (al.entity_type = 'evaluacion' AND al.entity_id IN (
         SELECT id FROM evaluaciones WHERE aplicacion_id = $2
       ))
       OR (al.entity_type = 'entrevista_ia' AND al.entity_id IN (
         SELECT id FROM entrevistas_ia WHERE aplicacion_id = $2
       ))
       OR (al.entity_type = 'documento' AND al.entity_id IN (
         SELECT id FROM documentos_candidato WHERE aplicacion_id = $2
       ))
       OR (al.entity_type = 'contrato' AND al.entity_id IN (
         SELECT id FROM contratos WHERE aplicacion_id = $2
       ))
     )
     ORDER BY al.created_at ASC`,
    [orgId, aplicacionId]
  );
  return rows;
}
