/**
 * Hashing y verificacion de contraseñas.
 *
 * CONTEXTO
 * Hasta ahora `authorize()` devolvia la sesion con solo comprobar que el email
 * existiera: la llamada a bcrypt estaba comentada y NO habia ninguna rama por
 * entorno, asi que el bypass aplicaba tambien en produccion. Conocer el email de
 * un usuario bastaba para entrar a su organizacion con todos sus permisos.
 * Ademas, el registro guardaba la contraseña en claro con el prefijo `$dev$`.
 *
 * ESTRATEGIA DE MIGRACION
 * Cerrar el agujero sin dejar a nadie fuera. Los hashes legacy (`$dev$<clave>`)
 * se siguen aceptando SOLO comparando la contraseña real, y en ese mismo login
 * se reescriben a bcrypt. El texto plano desaparece solo, a medida que la gente
 * entra, y desde el primer despliegue ya no se puede entrar sin la contraseña
 * correcta.
 */

import bcrypt from 'bcryptjs';

/** Coste de bcrypt. 12 es el equilibrio habitual entre seguridad y latencia. */
const BCRYPT_ROUNDS = 12;

/** Prefijo de los hashes heredados que guardaban la contraseña en claro. */
const PREFIJO_LEGACY = '$dev$';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export interface ResultadoVerificacion {
  /** La contraseña es correcta. */
  valida: boolean;
  /** El hash almacenado es legacy y debe reescribirse a bcrypt. */
  necesitaMigracion: boolean;
}

/**
 * Verifica una contraseña contra el hash almacenado.
 *
 * Nunca lanza: ante un hash corrupto o vacio devuelve `valida: false`, que es el
 * comportamiento seguro (denegar). No revela por que fallo.
 */
export async function verifyPassword(
  password: string,
  hash: string | null | undefined
): Promise<ResultadoVerificacion> {
  // Una contraseña vacia nunca es valida, aunque el hash legacy tambien lo este
  // (`$dev$` a secas). Sin esta guarda, una fila con el hash corrupto habilitaba
  // el acceso enviando la cadena vacia.
  if (!hash || !password) return { valida: false, necesitaMigracion: false };

  if (hash.startsWith(PREFIJO_LEGACY)) {
    // Comparacion en tiempo constante para no filtrar informacion por timing.
    const esperado = hash.slice(PREFIJO_LEGACY.length);
    const valida = tiempoConstanteIguales(password, esperado);
    return { valida, necesitaMigracion: valida };
  }

  try {
    const valida = await bcrypt.compare(password, hash);
    return { valida, necesitaMigracion: false };
  } catch {
    return { valida: false, necesitaMigracion: false };
  }
}

/**
 * Hash señuelo con el mismo coste que uno real.
 * Se calcula una sola vez al cargar el modulo.
 */
const HASH_SEÑUELO = bcrypt.hashSync('__usuario_inexistente__', BCRYPT_ROUNDS);

/**
 * Consume el tiempo de una verificacion real sin verificar nada.
 *
 * Se usa cuando el email no existe: asi el login tarda lo mismo exista o no la
 * cuenta, y no se puede enumerar quien tiene usuario midiendo la respuesta.
 */
export async function gastarTiempoDeVerificacion(): Promise<void> {
  try {
    await bcrypt.compare('__password_señuelo__', HASH_SEÑUELO);
  } catch {
    // Irrelevante: el objetivo es el tiempo consumido, no el resultado.
  }
}

/**
 * Comparacion de strings que no cortocircuita en la primera diferencia.
 *
 * Para los hashes legacy no se puede usar bcrypt (el valor guardado es la
 * contraseña en claro), asi que la comparacion se hace a mano evitando filtrar
 * cuantos caracteres coinciden.
 */
function tiempoConstanteIguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) {
    diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferencia === 0;
}
