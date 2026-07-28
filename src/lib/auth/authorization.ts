/**
 * Primitivas de autorizacion: control de rol y pertenencia de recursos.
 *
 * PROBLEMA QUE RESUELVE
 * Una auditoria sobre las 109 rutas de la API encontro el mismo defecto repetido
 * en modulos independientes: la organizacion se toma de la sesion para escribir
 * la fila propia, pero los UUID de las entidades relacionadas llegan del body o
 * de la URL y **nunca se comprueba que pertenezcan a esa organizacion**. Con eso
 * se podia crear una evaluacion, una entrevista, un contrato o una aplicacion
 * apuntando a candidatos y vacantes de otra empresa — y despues leer su PII a
 * traves de los JOIN, o incluso enviarles correos con la marca del atacante.
 *
 * Y en paralelo: `getUserRole()` existia desde el principio y NO lo llamaba
 * ninguna ruta, asi que un usuario `viewer` podia hacer absolutamente todo.
 *
 * Este modulo concentra las dos comprobaciones para que dejen de reescribirse
 * (mal) en cada sitio.
 */

import { pool } from '@/lib/db';
import { getUserRole } from './middleware';
import { ForbiddenError, NotFoundError } from '@/lib/utils/errors';

/** Cliente compatible con `pool` y con un client de transaccion. */
type Queryable = { query: typeof pool.query };

// OJO: el valor en BD es 'recruiter' (001_initial_schema.sql, y es el DEFAULT),
// no 'reclutador'. Usar el termino en español dejaba fuera a TODOS los
// reclutadores en cuanto se aplicara requireEscritura.
export type Rol = 'admin' | 'recruiter' | 'viewer';

/** Quien puede modificar datos del proceso de seleccion. */
export const ROLES_ESCRITURA: Rol[] = ['admin', 'recruiter'];
/** Quien puede tocar la configuracion de la empresa. */
export const ROLES_ADMIN: Rol[] = ['admin'];

/**
 * Exige que el usuario de la sesion tenga uno de los roles indicados.
 *
 * `getUserRole()` devuelve 'viewer' cuando el token no trae rol, asi que el
 * comportamiento por defecto es el mas restrictivo.
 */
export async function requireRole(rolesPermitidos: Rol[]): Promise<Rol> {
  const rol = (await getUserRole()) as Rol;
  if (!rolesPermitidos.includes(rol)) {
    throw new ForbiddenError(
      `Esta accion requiere rol ${rolesPermitidos.join(' o ')}. Tu rol actual es ${rol}.`
    );
  }
  return rol;
}

/** Atajo: solo administradores (configuracion de la empresa). */
export function requireAdmin(): Promise<Rol> {
  return requireRole(ROLES_ADMIN);
}

/** Atajo: quien puede operar el pipeline (admin o reclutador). */
export function requireEscritura(): Promise<Rol> {
  return requireRole(ROLES_ESCRITURA);
}

// ─── PERTENENCIA DE RECURSOS ──────────────────────────────────────────────

/**
 * Datos de una aplicacion ya verificada como perteneciente a la organizacion.
 * Se devuelven para que el llamador use ESTOS ids y no los del body.
 */
export interface AplicacionVerificada {
  id: string;
  candidato_id: string;
  vacante_id: string;
}

/**
 * Comprueba que una aplicacion pertenece a la organizacion y devuelve sus ids.
 *
 * La pertenencia se resuelve por `vacantes.organization_id`, que es la fuente de
 * verdad del multi-tenant: `aplicaciones.organization_id` esta denormalizado y es
 * NULLABLE, asi que filtrar por el deja huecos.
 *
 * Usa SIEMPRE los ids devueltos en lugar de los que venian en la peticion: es lo
 * que impide que alguien enlace su propio registro al candidato de otra empresa.
 */
export async function assertAplicacionDeOrg(
  aplicacionId: string,
  orgId: string,
  runner: Queryable = pool
): Promise<AplicacionVerificada> {
  const { rows } = await runner.query(
    `SELECT a.id, a.candidato_id, a.vacante_id
     FROM aplicaciones a
     JOIN vacantes v ON v.id = a.vacante_id
     WHERE a.id = $1 AND v.organization_id = $2`,
    [aplicacionId, orgId]
  );
  if (rows.length === 0) throw new NotFoundError('Aplicacion', aplicacionId);
  return rows[0];
}

/** Comprueba que un candidato pertenece a la organizacion. */
export async function assertCandidatoDeOrg(
  candidatoId: string,
  orgId: string,
  runner: Queryable = pool
): Promise<void> {
  const { rows } = await runner.query(
    `SELECT 1 FROM candidatos WHERE id = $1 AND organization_id = $2`,
    [candidatoId, orgId]
  );
  if (rows.length === 0) throw new NotFoundError('Candidato', candidatoId);
}

/** Comprueba que una vacante pertenece a la organizacion. */
export async function assertVacanteDeOrg(
  vacanteId: string,
  orgId: string,
  runner: Queryable = pool
): Promise<void> {
  const { rows } = await runner.query(
    `SELECT 1 FROM vacantes WHERE id = $1 AND organization_id = $2`,
    [vacanteId, orgId]
  );
  if (rows.length === 0) throw new NotFoundError('Vacante', vacanteId);
}

/**
 * Comprueba que una fila cualquiera pertenece a la organizacion.
 * Para tablas que tienen `organization_id` propio (plantillas, contratos,
 * evaluaciones, usuarios...).
 *
 * `tabla` NUNCA debe venir de la entrada del usuario: se valida contra una lista
 * cerrada para que no pueda convertirse en inyeccion por nombre de tabla.
 */
const TABLAS_CON_ORG = new Set([
  'plantillas_contrato',
  'contratos',
  'evaluaciones',
  'evaluacion_plantillas',
  'preguntas_banco',
  'users',
  'entrevistas_humanas',
  'onboarding',
  'documentos_onboarding',
  'tipos_contrato',
]);

export async function assertFilaDeOrg(
  tabla: string,
  filaId: string,
  orgId: string,
  runner: Queryable = pool
): Promise<void> {
  if (!TABLAS_CON_ORG.has(tabla)) {
    throw new Error(`assertFilaDeOrg: tabla no permitida "${tabla}"`);
  }
  const { rows } = await runner.query(
    `SELECT 1 FROM ${tabla} WHERE id = $1 AND organization_id = $2`,
    [filaId, orgId]
  );
  if (rows.length === 0) throw new NotFoundError(tabla, filaId);
}
