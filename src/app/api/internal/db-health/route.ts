import { requireAuth } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';

/**
 * GET /api/internal/db-health — identidad de la base a la que ESTE entorno esta
 * conectado. Sirve para verificar que preview y produccion apuntan a branches
 * de Neon distintos: comparar `endpoint` entre <preview-url> y <prod-url>.
 *
 * Solo devuelve el identificador del endpoint (ep-xxxx) y el nombre de la base;
 * nunca usuario, password ni la connection string completa.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

/** Extrae el endpoint de Neon (ep-xxxx) del host, sin credenciales. */
function endpointFromUrl(url?: string): string | null {
  if (!url) return null;
  const host = url.match(/@([^/:?]+)/)?.[1] ?? null;
  if (!host) return null;
  const ep = host.match(/ep-[a-z0-9-]+/i);
  return ep ? ep[0] : host;
}

export async function GET() {
  try {
    await requireAuth();

    const { rows } = await pool.query('SELECT current_database() AS db, now() AS server_time');

    return apiResponse({
      endpoint: endpointFromUrl(process.env.DATABASE_URL), // ep-xxxx = branch de Neon
      database: rows[0]?.db ?? null,
      serverTime: rows[0]?.server_time ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,            // production | preview | development
    });
  } catch (error) {
    return apiError(error);
  }
}
