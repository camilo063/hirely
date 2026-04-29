import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { pool } from '@/lib/db';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const organizacionId = await getOrgId();

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const soloNoLeidas = searchParams.get('no_leidas') === 'true';
    const busqueda = searchParams.get('q');
    const pagina = parseInt(searchParams.get('pagina') ?? '1');
    const porPagina = Math.min(parseInt(searchParams.get('por_pagina') ?? '20'), 100);
    const offset = (pagina - 1) * porPagina;

    const conditions: string[] = ['n.organization_id = $1'];
    const params: (string | number | boolean)[] = [organizacionId];
    let i = 2;

    if (tipo) {
      // Support comma-separated types
      const tipos = tipo.split(',').map(t => t.trim()).filter(Boolean);
      if (tipos.length === 1) {
        conditions.push(`n.tipo = $${i++}`);
        params.push(tipos[0]);
      } else if (tipos.length > 1) {
        conditions.push(`n.tipo = ANY($${i++}::text[])`);
        params.push(tipos as unknown as string);
      }
    }
    if (soloNoLeidas) {
      conditions.push(`n.leida = false`);
    }
    if (busqueda) {
      conditions.push(`(n.titulo ILIKE $${i} OR n.mensaje ILIKE $${i})`);
      params.push(`%${busqueda}%`);
      i++;
    }

    const where = conditions.join(' AND ');

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT id, tipo, titulo, mensaje, leida, meta, created_at, leida_at
         FROM notificaciones n
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, porPagina, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int as total FROM notificaciones n WHERE ${where}`,
        params
      ),
    ]);

    const { rows: noLeidas } = await pool.query(
      `SELECT COUNT(*)::int as total FROM notificaciones WHERE organization_id = $1 AND leida = false`,
      [organizacionId]
    );

    return NextResponse.json({
      notificaciones: dataResult.rows,
      total: countResult.rows[0].total,
      no_leidas: noLeidas[0].total,
      pagina,
      por_pagina: porPagina,
      total_paginas: Math.ceil(countResult.rows[0].total / porPagina),
    });
  } catch (error) {
    console.error('[GET /api/notificaciones]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAuth();
    const organizacionId = await getOrgId();

    const body = await request.json();

    if (body.todas === true) {
      await pool.query(
        `UPDATE notificaciones
         SET leida = true, leida_at = NOW()
         WHERE organization_id = $1 AND leida = false`,
        [organizacionId]
      );
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      await pool.query(
        `UPDATE notificaciones
         SET leida = true, leida_at = NOW()
         WHERE organization_id = $1 AND id = ANY($2::uuid[]) AND leida = false`,
        [organizacionId, body.ids]
      );
    }

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int as no_leidas FROM notificaciones WHERE organization_id = $1 AND leida = false`,
      [organizacionId]
    );
    return NextResponse.json({ ok: true, no_leidas: rows[0].no_leidas });
  } catch (error) {
    console.error('[PATCH /api/notificaciones]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
