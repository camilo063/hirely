import { pool } from '@/lib/db';
import { crearNotificacion } from '@/lib/services/notificaciones.service';

/** Dias sin firma tras los cuales un contrato enviado se considera estancado. */
const UMBRAL_CONTRATO_ESTANCADO_DIAS = 5;

export interface ResumenRecordatoriosPipeline {
  evaluacionesExpiradas: number;
  contratosEstancados: number;
}

/**
 * Marca evaluaciones tecnicas vencidas y avisa a los reclutadores de contratos
 * estancados en firma. Corre a diario via cron (ver
 * `src/app/api/cron/recordatorios-pipeline/route.ts`).
 *
 * `orgId` acota la corrida a una sola organizacion (disparo manual); sin el,
 * recorre todas las organizaciones (uso exclusivo del cron autenticado).
 */
export async function ejecutarRecordatoriosPipeline(
  orgId?: string
): Promise<ResumenRecordatoriosPipeline> {
  const evaluacionesExpiradas = await marcarEvaluacionesExpiradas(orgId);
  const contratosEstancados = await avisarContratosEstancados(orgId);
  return { evaluacionesExpiradas, contratosEstancados };
}

async function marcarEvaluacionesExpiradas(orgId?: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT e.id, e.organization_id, e.titulo,
            c.nombre as candidato_nombre, c.apellido as candidato_apellido,
            v.titulo as vacante_titulo
     FROM evaluaciones e
     JOIN candidatos c ON c.id = e.candidato_id
     JOIN vacantes v ON v.id = e.vacante_id
     WHERE e.estado = 'enviada'
       AND e.token_expira_at IS NOT NULL
       AND e.token_expira_at < NOW()
       ${orgId ? 'AND e.organization_id = $1' : ''}`,
    orgId ? [orgId] : []
  );

  if (rows.length === 0) return 0;

  await pool.query(
    `UPDATE evaluaciones SET estado = 'expirada', updated_at = NOW()
     WHERE id = ANY($1::uuid[])`,
    [rows.map((r) => r.id)]
  );

  for (const ev of rows) {
    const candidatoNombre = `${ev.candidato_nombre} ${ev.candidato_apellido || ''}`.trim();
    await crearNotificacion({
      organizacionId: ev.organization_id,
      tipo: 'evaluacion_tecnica_expirada',
      titulo: 'Evaluacion tecnica expirada',
      mensaje: `${candidatoNombre} no completo la prueba tecnica para ${ev.vacante_titulo} antes de que expirara`,
      meta: { evaluacion_id: ev.id },
    });
  }

  return rows.length;
}

async function avisarContratosEstancados(orgId?: string): Promise<number> {
  // A diferencia de las evaluaciones (que se marcan 'expirada' y dejan de
  // matchear el WHERE), un contrato sigue en 'enviado'/sin firmar
  // indefinidamente: sin el NOT EXISTS de abajo, el cron lo notificaria de
  // nuevo cada dia para siempre. Se avisa una sola vez por contrato.
  const { rows } = await pool.query(
    `SELECT c.id, a.organization_id,
            cand.nombre as candidato_nombre, cand.apellido as candidato_apellido,
            v.titulo as vacante_titulo,
            EXTRACT(DAY FROM (NOW() - c.enviado_firma_at)) as dias_estancado
     FROM contratos c
     JOIN aplicaciones a ON a.id = c.aplicacion_id
     JOIN candidatos cand ON cand.id = a.candidato_id
     JOIN vacantes v ON v.id = a.vacante_id
     WHERE c.estado = 'enviado'
       AND c.firmado_at IS NULL
       AND c.enviado_firma_at IS NOT NULL
       AND c.enviado_firma_at < NOW() - INTERVAL '${UMBRAL_CONTRATO_ESTANCADO_DIAS} days'
       AND NOT EXISTS (
         SELECT 1 FROM notificaciones n
         WHERE n.tipo = 'contrato_firma_pendiente_prolongada'
           AND n.meta->>'contrato_id' = c.id::text
       )
       ${orgId ? 'AND a.organization_id = $1' : ''}`,
    orgId ? [orgId] : []
  );

  for (const c of rows) {
    const candidatoNombre = `${c.candidato_nombre} ${c.candidato_apellido || ''}`.trim();
    await crearNotificacion({
      organizacionId: c.organization_id,
      tipo: 'contrato_firma_pendiente_prolongada',
      titulo: 'Firma de contrato pendiente hace dias',
      mensaje: `El contrato de ${candidatoNombre} para ${c.vacante_titulo} lleva ${Math.floor(Number(c.dias_estancado))} dias sin firmarse`,
      meta: { contrato_id: c.id },
    });
  }

  return rows.length;
}
