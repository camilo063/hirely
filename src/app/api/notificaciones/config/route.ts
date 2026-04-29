import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { pool } from '@/lib/db';

export const maxDuration = 10;

export async function GET() {
  try {
    await requireAuth();
    const organizacionId = await getOrgId();

    const { rows } = await pool.query(
      `SELECT tipo, inapp_activo, browser_activo, prioridad
       FROM notificacion_config
       WHERE organization_id = $1`,
      [organizacionId]
    );

    return NextResponse.json({ config: rows });
  } catch (error) {
    console.error('[GET /api/notificaciones/config]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
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
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[PUT /api/notificaciones/config]', error);
    return NextResponse.json({ error: 'Error guardando config' }, { status: 500 });
  }
}
