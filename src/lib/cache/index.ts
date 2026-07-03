import { Redis } from '@upstash/redis';

/**
 * Capa de cache compartida (Upstash Redis) con degradacion elegante.
 *
 * - En prod/preview: usa Upstash (vars KV_REST_API_URL / KV_REST_API_TOKEN que
 *   inyecta la integracion de Vercel). Read-through con invalidacion explicita.
 * - En local (sin esas vars) o si Upstash falla: cae SIEMPRE a la BD. La app
 *   nunca se rompe por el cache; en el peor caso se comporta como antes.
 *
 * Solo para datos org-scoped de baja volatilidad (config). Las escrituras deben
 * llamar invalidate() con la misma key para mantener consistencia inmediata.
 */

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

/** true si hay un backend de cache configurado (util para logs/diagnostico). */
export const cacheEnabled = redis !== null;

/** TTL por defecto para datos de configuracion (segundos). La invalidacion
 *  explicita mantiene la frescura; el TTL es solo una red de seguridad. */
export const CONFIG_TTL = 60 * 60; // 1 hora

/** TTL para metricas/agregaciones (dashboard, reportes). Son datos derivados y
 *  pesados que toleran estar ligeramente desactualizados; NO se invalidan de
 *  forma explicita, el TTL corto es suficiente. */
export const METRICS_TTL = 45; // segundos

/**
 * Read-through: devuelve el valor cacheado o ejecuta `fn`, cachea su resultado
 * y lo devuelve. Si no hay cache configurado o Upstash falla, ejecuta `fn`
 * directo. Nunca lanza por errores de cache.
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = CONFIG_TTL
): Promise<T> {
  if (!redis) return fn();

  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch (err) {
    console.warn(`[cache] get fallo para "${key}":`, err);
    return fn();
  }

  const fresh = await fn();

  try {
    await redis.set(key, fresh, { ex: ttlSeconds });
  } catch (err) {
    console.warn(`[cache] set fallo para "${key}":`, err);
  }

  return fresh;
}

/**
 * Prueba de conectividad en runtime: hace un round-trip real set/get/del.
 * Distingue "cache activo de verdad" de "solo hay env vars". Para diagnostico.
 */
export async function cachePing(): Promise<{ ok: boolean; error?: string }> {
  if (!redis) return { ok: false, error: 'sin-credenciales' };
  try {
    const k = '__health__:ping';
    await redis.set(k, '1', { ex: 10 });
    const v = await redis.get(k);
    await redis.del(k);
    return { ok: v === '1' || v === 1 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Invalida una o mas keys. No-op si no hay cache. Nunca lanza. */
export async function invalidate(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    console.warn(`[cache] del fallo para ${keys.join(', ')}:`, err);
  }
}

/**
 * Catalogo centralizado de keys de cache. Todas org-scoped bajo el prefijo
 * `org:<id>:` para poder razonar (y en el futuro barrer) por organizacion.
 */
export const cacheKeys = {
  pipelineEstados: (orgId: string) => `org:${orgId}:pipeline-estados`,
  evaluacionCampos: (orgId: string) => `org:${orgId}:evaluacion-campos`,
  tiposContrato: (orgId: string, onlyActive: boolean) =>
    `org:${orgId}:tipos-contrato:${onlyActive ? 'active' : 'all'}`,
  scoringConfig: (orgId: string) => `org:${orgId}:scoring-config`,
  emailsConfig: (orgId: string) => `org:${orgId}:emails-config`,
  notificacionConfig: (orgId: string) => `org:${orgId}:notificacion-config`,

  // Metricas/agregaciones (nivel tibio, TTL corto).
  dashboard: (orgId: string) => `org:${orgId}:dashboard`,
  // `report` = kpis|funnel|tiempos|volumen|top-vacantes|scores.
  // `variant` = serializacion de los filtros que afectan el resultado ('' si no hay).
  reportes: (orgId: string, report: string, variant = '') =>
    `org:${orgId}:reportes:${report}${variant ? `:${variant}` : ''}`,
} as const;

/**
 * Invalida ambas variantes (active/all) del cache de tipos de contrato de una
 * org. Se usa desde todos los puntos de escritura de tipos_contrato.
 */
export async function invalidateTiposContrato(orgId: string): Promise<void> {
  await invalidate(cacheKeys.tiposContrato(orgId, true), cacheKeys.tiposContrato(orgId, false));
}
