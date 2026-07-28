/**
 * Limitacion de frecuencia para endpoints publicos.
 *
 * PROBLEMA QUE RESUELVE
 * No existia ningun control de frecuencia en todo el proyecto. Los endpoints sin
 * sesion podian invocarse en bucle, y varios tienen coste real por peticion:
 * el formulario de postulacion dispara parseo de CV y scoring con Claude (coste
 * directo en la factura de IA), la renovacion de link envia un correo, y el
 * registro de eventos de seguridad de las evaluaciones escribe en un JSONB que
 * crece sin tope.
 *
 * IMPLEMENTACION
 * Ventana fija con contador. Usa Upstash Redis cuando esta configurado (lo
 * correcto en serverless, donde cada instancia tiene su propia memoria) y cae a
 * un contador en memoria cuando no lo esta, para que en desarrollo funcione
 * igual.
 *
 * Ante un fallo o una lentitud de Redis se cae al contador en memoria (con un
 * tope de 500 ms de espera): un problema de infraestructura del limitador no
 * debe tumbar ni ralentizar la aplicacion. El limitador es una proteccion de
 * coste y abuso, no un control de acceso — la autorizacion vive en otro sitio.
 */

import { Redis } from '@upstash/redis';

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

/** Tope de espera al limitador. Mas alla de esto no vale la pena bloquear. */
const TIMEOUT_REDIS_MS = 500;

export interface OpcionesRateLimit {
  /** Identificador de quien pide: IP, token de portal, email... */
  clave: string;
  /** Peticiones permitidas dentro de la ventana. */
  limite: number;
  /** Duracion de la ventana, en segundos. */
  ventanaSegundos: number;
}

export interface ResultadoRateLimit {
  permitido: boolean;
  restantes: number;
  /** Segundos que faltan para que la ventana se reinicie. */
  reintentarEn: number;
}

// ─── Fallback en memoria ──────────────────────────────────────────────────
// Solo cubre el proceso actual. Es suficiente en desarrollo y en despliegues de
// una sola instancia; en serverless con varias instancias, cada una lleva su
// cuenta (el limite efectivo se multiplica por el numero de instancias). Por eso
// Redis es el camino recomendado en produccion.
const memoria = new Map<string, { conteo: number; expiraEn: number }>();

function limpiarMemoria(ahora: number): void {
  if (memoria.size < 5000) return; // solo se barre cuando crece de verdad
  memoria.forEach((v, k) => {
    if (v.expiraEn <= ahora) memoria.delete(k);
  });
}

function rateLimitMemoria(opts: OpcionesRateLimit): ResultadoRateLimit {
  const ahora = Date.now();
  limpiarMemoria(ahora);

  const entrada = memoria.get(opts.clave);
  if (!entrada || entrada.expiraEn <= ahora) {
    memoria.set(opts.clave, { conteo: 1, expiraEn: ahora + opts.ventanaSegundos * 1000 });
    return { permitido: true, restantes: opts.limite - 1, reintentarEn: opts.ventanaSegundos };
  }

  entrada.conteo++;
  const reintentarEn = Math.max(1, Math.ceil((entrada.expiraEn - ahora) / 1000));
  return {
    permitido: entrada.conteo <= opts.limite,
    restantes: Math.max(0, opts.limite - entrada.conteo),
    reintentarEn,
  };
}

/**
 * Consume una unidad del cupo y dice si la peticion puede continuar.
 * Nunca lanza.
 */
export async function rateLimit(opts: OpcionesRateLimit): Promise<ResultadoRateLimit> {
  const clave = `ratelimit:${opts.clave}`;

  if (!redis) return rateLimitMemoria(opts);

  try {
    // Con un tope de tiempo. Sin el, el SDK de Upstash reintenta con backoff y
    // una instancia degradada costaba ~4.3 s en CADA peticion — el 43% del
    // presupuesto de una ruta con maxDuration 10. Si el limitador no responde
    // rapido, se cae al contador en memoria: es mejor un limite aproximado que
    // penalizar cada request.
    const resultado = await Promise.race([
      (async () => {
        const conteo = await redis.incr(clave);
        if (conteo === 1) {
          // Primera peticion de la ventana: se le pone caducidad.
          await redis.expire(clave, opts.ventanaSegundos);
        }
        const ttl = await redis.ttl(clave);
        return {
          permitido: conteo <= opts.limite,
          restantes: Math.max(0, opts.limite - conteo),
          // `ttl` puede venir -1 si el proceso murio entre el incr y el expire:
          // en ese caso se reinstaura la caducidad para no bloquear al cliente.
          reintentarEn: ttl > 0 ? ttl : opts.ventanaSegundos,
        } satisfies ResultadoRateLimit;
      })(),
      new Promise<null>((r) => setTimeout(() => r(null), TIMEOUT_REDIS_MS)),
    ]);

    if (resultado === null) {
      console.warn('[RateLimit] Redis no respondio a tiempo, se usa el contador en memoria');
      return rateLimitMemoria(opts);
    }
    return resultado;
  } catch (error) {
    console.error('[RateLimit] Fallo de Redis, se usa el contador en memoria:', error);
    return rateLimitMemoria(opts);
  }
}

/**
 * IP del cliente a partir de las cabeceras del proxy.
 *
 * En Vercel el valor fiable es el PRIMER elemento de `x-forwarded-for`. Devuelve
 * 'desconocida' si no hay ninguna: en ese caso todas las peticiones sin IP
 * comparten cupo, que es el comportamiento conservador.
 */
export function ipDeRequest(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'desconocida';
}

/**
 * Respuesta 429 estandar, con `Retry-After` para que los clientes bien educados
 * sepan cuando reintentar.
 */
export function respuesta429(reintentarEn: number, mensaje?: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: mensaje || 'Demasiadas peticiones. Intenta de nuevo en unos minutos.',
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, reintentarEn)),
      },
    }
  );
}
