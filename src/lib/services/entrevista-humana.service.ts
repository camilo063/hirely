import { pool } from '../db';
import { UUID } from '../types/common.types';
import {
  EntrevistaHumana, EntrevistaHumanaConDetalles,
  CreateEntrevistaHumanaInput, EvaluacionHumana,
} from '../types/entrevista.types';
import { NotFoundError } from '../utils/errors';
import { guardarEvaluacionHumana } from './scoring-dual.service';
import { crearEventoParaEntrevista } from './calendario.service';
import { assertAplicacionDeOrg, assertFilaDeOrg } from '@/lib/auth/authorization';

export async function createEntrevistaHumana(
  orgId: UUID,
  input: CreateEntrevistaHumanaInput,
  userId?: string
): Promise<EntrevistaHumana & { meet_link?: string }> {
  // Los tres UUID llegan del body. Sin validarlos se podia agendar una entrevista
  // propia sobre la aplicacion de otra empresa y leer despues, via los JOIN del
  // GET, el nombre y el email de su candidato y el titulo de su vacante.
  // `candidato_id` y `vacante_id` se derivan de la aplicacion verificada.
  const aplicacion = await assertAplicacionDeOrg(input.aplicacion_id, orgId);

  // El entrevistador tambien: un id ajeno filtraba el nombre de un empleado de
  // otra organizacion a traves del JOIN a `users`.
  if (input.entrevistador_id) {
    await assertFilaDeOrg('users', input.entrevistador_id, orgId);
  }

  const result = await pool.query<EntrevistaHumana>(
    `INSERT INTO entrevistas_humanas (organization_id, aplicacion_id, candidato_id, vacante_id,
      entrevistador_id, fecha_programada, notas)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      orgId, aplicacion.id, aplicacion.candidato_id, aplicacion.vacante_id,
      input.entrevistador_id, input.fecha_programada, input.notas ?? null,
    ]
  );

  const entrevista = result.rows[0];

  // Non-blocking: try to create Google Calendar event with Meet link
  if (userId && input.crear_evento_calendar !== false) {
    try {
      const calResult = await crearEventoParaEntrevista(entrevista.id, userId, orgId);
      if (calResult.success && calResult.meetLink) {
        return { ...entrevista, meet_link: calResult.meetLink };
      }
    } catch (err) {
      console.error('[Entrevista] Calendar event creation failed (non-blocking):', err);
    }
  }

  return entrevista;
}

export async function getEntrevistaHumana(orgId: UUID, entrevistaId: UUID): Promise<EntrevistaHumanaConDetalles> {
  const result = await pool.query<EntrevistaHumanaConDetalles>(
    `SELECT eh.*,
      c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
      v.titulo as vacante_titulo,
      u.name as entrevistador_nombre
    FROM entrevistas_humanas eh
    JOIN candidatos c ON eh.candidato_id = c.id AND c.organization_id = eh.organization_id
    JOIN vacantes v ON eh.vacante_id = v.id AND v.organization_id = eh.organization_id
    JOIN users u ON eh.entrevistador_id = u.id AND u.organization_id = eh.organization_id
    WHERE eh.id = $1 AND eh.organization_id = $2`,
    [entrevistaId, orgId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Entrevista Humana', entrevistaId);
  return result.rows[0];
}

export async function submitEvaluacion(
  orgId: UUID,
  entrevistaId: UUID,
  evaluacion: EvaluacionHumana
): Promise<any> {
  // Use the new scoring-dual service which handles evaluation + dual score calculation
  return guardarEvaluacionHumana(entrevistaId, evaluacion, orgId);
}

export async function listEntrevistasHumanas(
  orgId: UUID,
  vacanteId?: UUID
): Promise<EntrevistaHumanaConDetalles[]> {
  let query = `
    SELECT eh.*,
      c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
      v.titulo as vacante_titulo,
      u.name as entrevistador_nombre
    FROM entrevistas_humanas eh
    JOIN candidatos c ON eh.candidato_id = c.id AND c.organization_id = eh.organization_id
    JOIN vacantes v ON eh.vacante_id = v.id AND v.organization_id = eh.organization_id
    JOIN users u ON eh.entrevistador_id = u.id AND u.organization_id = eh.organization_id
    WHERE eh.organization_id = $1`;

  const params: unknown[] = [orgId];

  if (vacanteId) {
    query += ' AND eh.vacante_id = $2';
    params.push(vacanteId);
  }

  query += ' ORDER BY eh.fecha_programada DESC';

  const result = await pool.query<EntrevistaHumanaConDetalles>(query, params);
  return result.rows;
}
