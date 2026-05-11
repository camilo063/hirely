import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { pool } from '@/lib/db';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const organizacionId = await getOrgId();

    const { searchParams } = new URL(request.url);
    const desde = searchParams.get('desde');

    const params: (string | number)[] = [organizacionId];
    let whereExtra = '';
    if (desde) {
      params.push(desde);
      whereExtra = `AND created_at > $2`;
    }

    const [notifResult, countResult, nowResult] = await Promise.all([
      pool.query(
        `SELECT id, tipo, titulo, mensaje, leida, meta, created_at
         FROM notificaciones
         WHERE organization_id = $1 ${whereExtra}
         ORDER BY created_at DESC
         LIMIT 50`,
        params
      ),
      pool.query(
        `SELECT COUNT(*)::int as no_leidas
         FROM notificaciones
         WHERE organization_id = $1 AND leida = false`,
        [organizacionId]
      ),
      pool.query(`SELECT NOW() as ts`),
    ]);

    return NextResponse.json(
      {
        notificaciones: notifResult.rows,
        no_leidas: countResult.rows[0].no_leidas,
        timestamp: nowResult.rows[0].ts,
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('[GET /api/notificaciones/poll]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
