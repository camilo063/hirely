import { requireAuth } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { cacheEnabled, cachePing } from '@/lib/cache';

/**
 * GET /api/internal/cache-health — diagnostico de la capa de cache.
 *
 * Confirma si el cache Upstash esta ACTIVO en runtime (no solo si hay env vars).
 * Util para verificar en preview/prod que no estamos cayendo a fallback silencioso.
 * Solo devuelve booleanos: nunca expone URLs ni tokens.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET() {
  try {
    await requireAuth();

    return apiResponse({
      cacheEnabled,                       // hay credenciales configuradas
      hasUrl: !!process.env.KV_REST_API_URL,
      hasToken: !!process.env.KV_REST_API_TOKEN,
      ping: await cachePing(),            // { ok } si el round-trip real funciona
    });
  } catch (error) {
    return apiError(error);
  }
}
