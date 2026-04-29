import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { pool } from '@/lib/db';

interface ChecklistPaso {
  id: string;
  paso: string;
  completado: boolean;
  completado_at: string | null;
}

const PASOS = ['empresa', 'vacante', 'candidato', 'email_template', 'portal_test'];

export const maxDuration = 10;

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    // Check if dismissed
    const dismissCheck = await pool.query(
      `SELECT completado FROM onboarding_checklist WHERE organization_id = $1 AND paso = 'dismissed'`,
      [orgId]
    );
    if (dismissCheck.rows.length > 0 && dismissCheck.rows[0].completado) {
      return NextResponse.json({ pasos: [], todoCompleto: true, dismissed: true });
    }

    // Auto-detect completion from real data
    const [empresaR, vacanteR, candidatoR, emailR, portalR] = await Promise.all([
      pool.query(
        `SELECT config_empresa FROM organizations WHERE id = $1`,
        [orgId]
      ),
      pool.query(
        `SELECT COUNT(*)::int as c FROM vacantes WHERE organization_id = $1`,
        [orgId]
      ),
      pool.query(
        `SELECT COUNT(*)::int as c FROM candidatos WHERE organization_id = $1`,
        [orgId]
      ),
      pool.query(
        `SELECT id FROM org_settings WHERE organization_id = $1`,
        [orgId]
      ),
      pool.query(
        `SELECT COUNT(*)::int as c FROM aplicaciones WHERE organization_id = $1 AND origen = 'portal'`,
        [orgId]
      ),
    ]);

    const configEmpresa = empresaR.rows[0]?.config_empresa;
    const empresaOk = !!(configEmpresa && configEmpresa.nit && configEmpresa.representante_legal);
    const vacanteOk = (vacanteR.rows[0]?.c || 0) > 0;
    const candidatoOk = (candidatoR.rows[0]?.c || 0) > 0;
    const emailOk = emailR.rows.length > 0;
    const portalOk = (portalR.rows[0]?.c || 0) > 0;

    const completionMap: Record<string, boolean> = {
      empresa: empresaOk,
      vacante: vacanteOk,
      candidato: candidatoOk,
      email_template: emailOk,
      portal_test: portalOk,
    };

    // Upsert checklist records
    for (const paso of PASOS) {
      await pool.query(
        `INSERT INTO onboarding_checklist (organization_id, paso, completado, completado_at)
         VALUES ($1, $2, $3, CASE WHEN $3 THEN NOW() ELSE NULL END)
         ON CONFLICT (organization_id, paso)
         DO UPDATE SET completado = $3, completado_at = CASE WHEN $3 THEN COALESCE(onboarding_checklist.completado_at, NOW()) ELSE NULL END`,
        [orgId, paso, completionMap[paso]]
      );
    }

    const pasos: ChecklistPaso[] = PASOS.map(p => ({
      id: p,
      paso: p,
      completado: completionMap[p],
      completado_at: null,
    }));

    const todoCompleto = pasos.every(p => p.completado);

    return NextResponse.json({ pasos, todoCompleto, dismissed: false });
  } catch (error) {
    console.error('[GET /api/onboarding-checklist]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    const body = await request.json();

    if (body.dismissed === true) {
      await pool.query(
        `INSERT INTO onboarding_checklist (organization_id, paso, completado, completado_at)
         VALUES ($1, 'dismissed', true, NOW())
         ON CONFLICT (organization_id, paso)
         DO UPDATE SET completado = true, completado_at = NOW()`,
        [orgId]
      );
      return NextResponse.json({ ok: true, dismissed: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[POST /api/onboarding-checklist]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
