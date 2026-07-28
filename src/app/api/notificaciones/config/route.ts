import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { pool } from '@/lib/db';
import { cached, invalidate, cacheKeys } from '@/lib/cache';
import { requireAdmin } from '@/lib/auth/authorization';
import { apiError } from '@/lib/utils/api-response';

export const maxDuration = 10;

export async function GET() {
  try {
    await requireAuth();
    const organizacionId = await getOrgId();

    const config = await cached(cacheKeys.notificacionConfig(organizacionId), async () => {
      const { rows } = await pool.query(
        `SELECT tipo, inapp_activo, browser_activo, prioridad
         FROM notificacion_config
         WHERE organization_id = $1`,
        [organizacionId]
      );
      return rows;
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error('[GET /api/notificaciones/config]', error);
    // `apiError` traduce UnauthorizedError -> 401 y ForbiddenError -> 403.
    // Con el 500 fijo, el cliente no podia distinguir 'sin permiso' de 'roto'.
    return apiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    // Solo administradores: esta ruta cambia configuracion de toda la empresa.
    await requireAdmin();
    const organizacionId = await getOrgId();

    const body = await request.json();
    const configItems: Array<{ tipo: string; inapp_activo: boolean; browser_activo: boolean; prioridad: string }> = body.config;

    if (!Array.isArray(configItems)) {
      return NextResponse.json({ error: 'config debe ser un array' }, { status: 400 });
    }

    for (const item of configItems) {
      await pool.query(
        `INSERT INTO notificacion_config (organization_id, tipo, inapp_activo, browser_activo, prioridad, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (organization_id, tipo)
         DO UPDATE SET
           inapp_activo   = EXCLUDED.inapp_activo,
           browser_activo = EXCLUDED.browser_activo,
           prioridad      = EXCLUDED.prioridad,
           updated_at     = NOW()`,
        [organizacionId, item.tipo, item.inapp_activo, item.browser_activo, item.prioridad]
      );
    }
    await invalidate(cacheKeys.notificacionConfig(organizacionId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[PUT /api/notificaciones/config]', error);
    // `apiError` traduce ForbiddenError -> 403 y UnauthorizedError -> 401. Con el
    // 500 fijo, un recruiter o un anonimo recibian "error interno" en vez de
    // "no tienes permiso", y el cliente no podia reaccionar.
    return apiError(error);
  }
}
