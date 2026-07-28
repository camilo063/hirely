/**
 * Transiciones de estado del pipeline de aplicaciones.
 *
 * PROBLEMA QUE RESUELVE
 * Varios servicios avanzaban el pipeline con un `UPDATE aplicaciones SET estado`
 * suelto sin tocar `estados_completados` (scoring ATS, evaluacion tecnica,
 * entrevista IA, webhooks de firma). Como `estados_completados` es lo que
 * alimenta los prerequisitos de la maquina de estados, el candidato avanzaba
 * "sin dejar huella" y mas adelante el selector lo bloqueaba con mensajes del
 * tipo "Requiere completar: Entrevista humana" sobre una etapa que ya habia
 * pasado. El pipeline quedaba trancado sin forma obvia de destrabarlo.
 *
 * Este modulo centraliza el cambio de estado: quien avance el pipeline debe
 * hacerlo por aqui para que el historial quede consistente.
 */

import { pool } from '@/lib/db';
import { PIPELINE_STATES_CONFIG, type PipelineState } from '@/lib/constants/pipeline-states';
import {
  getPipelineEstadosConfig,
  getPipelineEstadosConfigCon,
} from '@/lib/services/pipeline-config.service';

/** Cliente de BD compatible con `pool` y con un client de transaccion. */
type Queryable = { query: typeof pool.query };

export interface TransicionOptions {
  /** Cliente de transaccion. Por defecto usa el pool. */
  runner?: Queryable;
  /**
   * Solo aplica la transicion si el estado actual esta en esta lista.
   * Reemplaza los `WHERE id = $1 AND estado IN (...)` que estaban dispersos.
   */
  soloDesde?: string[];
  /**
   * Si true (default), nunca retrocede: ignora la transicion cuando el estado
   * destino tiene un `orden` menor que el actual. Evita que un webhook tardio
   * o un reproceso devuelvan al candidato a una etapa anterior.
   */
  noRetroceder?: boolean;
  /** Organizacion, para respetar el `orden` configurado por la empresa. */
  orgId?: string;
}

export interface TransicionResultado {
  cambiado: boolean;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  estadosCompletados: string[];
  razon?: string;
}

/**
 * Devuelve el catalogo de estados a usar: el de la organizacion si se conoce,
 * el fijo si no. Nunca lanza — ante cualquier fallo cae al catalogo por defecto.
 *
 * Cuando la transicion corre dentro de una transaccion (`runner` presente), la
 * lectura se hace sobre ESE mismo cliente. Pedir una conexion nueva del pool
 * mientras la actual esta ocupada por el BEGIN provoca un deadlock por
 * agotamiento del pool en cuanto hay concurrencia.
 */
async function getCatalogo(
  orgId?: string,
  runner?: Queryable
): Promise<PipelineState[]> {
  if (!orgId) return PIPELINE_STATES_CONFIG;
  try {
    if (runner) return await getPipelineEstadosConfigCon(orgId, runner);
    return await getPipelineEstadosConfig(orgId);
  } catch (error) {
    console.error('[Pipeline] No se pudo leer el catalogo de estados, usando el default:', error);
    return PIPELINE_STATES_CONFIG;
  }
}

/**
 * Estados "de flujo" (todos menos `descartado`) ordenados por `orden`.
 * `descartado` vive fuera de la linea temporal: se puede llegar a el desde
 * cualquier punto, por lo que no participa del backfill de historial.
 */
function estadosDeFlujo(catalogo: PipelineState[]): PipelineState[] {
  return catalogo
    .filter((s) => s.key !== 'descartado')
    .sort((a, b) => a.orden - b.orden);
}

/**
 * Calcula el `estados_completados` resultante de llegar a `nuevoEstado`.
 *
 * Marca como completados todos los estados de flujo anteriores al destino. Esto
 * es lo que significa estar en una etapa: las anteriores ya quedaron atras. Sin
 * este backfill, un candidato que avanzo por automatismos (scoring -> prueba
 * tecnica) llegaba a "Seleccionado" con el historial vacio y la maquina de
 * estados lo bloqueaba pidiendole etapas que el sistema mismo se habia saltado.
 *
 * `descartado` es la excepcion: solo acumula el estado del que viene, porque
 * descartar a alguien en "En revision" no significa que haya hecho entrevistas.
 */
export function calcularEstadosCompletados(
  estadoActual: string | null,
  nuevoEstado: string,
  estadosCompletados: string[],
  catalogo: PipelineState[] = PIPELINE_STATES_CONFIG
): string[] {
  const acumulado = new Set(estadosCompletados);
  if (estadoActual) acumulado.add(estadoActual);

  if (nuevoEstado !== 'descartado') {
    const flujo = estadosDeFlujo(catalogo);
    const destino = flujo.find((s) => s.key === nuevoEstado);
    if (destino) {
      for (const estado of flujo) {
        if (estado.orden < destino.orden) acumulado.add(estado.key);
      }
    }
  }

  // El estado destino aun no esta "completado": es donde el candidato esta.
  acumulado.delete(nuevoEstado);
  return Array.from(acumulado);
}

/**
 * Cambia el estado de una aplicacion manteniendo `estados_completados` al dia.
 *
 * Es idempotente: si la aplicacion ya esta en `nuevoEstado` no hace nada y
 * devuelve `cambiado: false`. Nunca lanza por una transicion no aplicable —
 * devuelve el motivo para que el llamador decida si le importa.
 */
export async function transicionarEstado(
  aplicacionId: string,
  nuevoEstado: string,
  options: TransicionOptions = {}
): Promise<TransicionResultado> {
  const runner = options.runner ?? pool;
  const noRetroceder = options.noRetroceder ?? true;

  // Aislamiento por organizacion.
  //
  // Cuando se conoce la organizacion, TODA lectura y escritura queda acotada a
  // ella. Sin esto la funcion operaba con `WHERE id = $1` a secas: como varios
  // llamadores validan la pertenencia por su cuenta pero no abortan si no
  // coincide (p. ej. la ruta de evaluacion humana seguia adelante aunque su
  // UPDATE afectara 0 filas), un usuario podia cambiar el estado de una
  // aplicacion de otra empresa pasando su id en la URL.
  //
  // La pertenencia se resuelve por la vacante, que es la fuente de verdad del
  // multi-tenant (aplicaciones.organization_id es denormalizado).
  const scopeSql = options.orgId
    ? `AND EXISTS (SELECT 1 FROM vacantes v WHERE v.id = aplicaciones.vacante_id AND v.organization_id = $2)`
    : '';
  const scopeParams = options.orgId ? [options.orgId] : [];

  const actual = await runner.query(
    `SELECT estado, estados_completados FROM aplicaciones
     WHERE id = $1 ${scopeSql}`,
    [aplicacionId, ...scopeParams]
  );
  if (actual.rows.length === 0) {
    return {
      cambiado: false,
      estadoAnterior: null,
      estadoNuevo: null,
      estadosCompletados: [],
      razon: 'Aplicacion no encontrada',
    };
  }

  const estadoAnterior: string | null = actual.rows[0].estado ?? null;
  const completadosPrevios: string[] = actual.rows[0].estados_completados || [];

  const sinCambio = (razon: string): TransicionResultado => ({
    cambiado: false,
    estadoAnterior,
    estadoNuevo: estadoAnterior,
    estadosCompletados: completadosPrevios,
    razon,
  });

  if (estadoAnterior === nuevoEstado) return sinCambio('Ya esta en ese estado');

  if (options.soloDesde && (!estadoAnterior || !options.soloDesde.includes(estadoAnterior))) {
    return sinCambio(`Transicion solo permitida desde: ${options.soloDesde.join(', ')}`);
  }

  const catalogo = await getCatalogo(options.orgId, options.runner);

  if (noRetroceder && estadoAnterior && nuevoEstado !== 'descartado') {
    const flujo = estadosDeFlujo(catalogo);
    const ordenActual = flujo.find((s) => s.key === estadoAnterior)?.orden;
    const ordenNuevo = flujo.find((s) => s.key === nuevoEstado)?.orden;
    if (ordenActual !== undefined && ordenNuevo !== undefined && ordenNuevo < ordenActual) {
      return sinCambio(`No se retrocede de ${estadoAnterior} a ${nuevoEstado}`);
    }
  }

  const estadosCompletados = calcularEstadosCompletados(
    estadoAnterior,
    nuevoEstado,
    completadosPrevios,
    catalogo
  );

  const escrito = await runner.query(
    `UPDATE aplicaciones
     SET estado = $2, estados_completados = $3, estado_updated_at = NOW(), updated_at = NOW()
     WHERE id = $1
       ${options.orgId
         ? 'AND EXISTS (SELECT 1 FROM vacantes v WHERE v.id = aplicaciones.vacante_id AND v.organization_id = $4)'
         : ''}`,
    options.orgId
      ? [aplicacionId, nuevoEstado, estadosCompletados, options.orgId]
      : [aplicacionId, nuevoEstado, estadosCompletados]
  );

  // El scope se revalida en la escritura, no solo en la lectura: entre ambas
  // podria haber cambiado algo, y el llamador debe saber si el cambio ocurrio.
  if ((escrito.rowCount ?? 0) === 0) {
    return sinCambio('La aplicacion no pertenece a esta organizacion');
  }

  return { cambiado: true, estadoAnterior, estadoNuevo: nuevoEstado, estadosCompletados };
}
