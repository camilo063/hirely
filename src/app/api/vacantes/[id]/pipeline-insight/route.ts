import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { pool } from '@/lib/db';

interface PipelineInsight {
  tipo: string;
  titulo: string;
  descripcion: string;
  cantidad: number;
  cta_texto: string;
  cta_href: string;
  prioridad: 'alta' | 'media' | 'baja';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id: vacanteId } = await params;

    // Verify ownership and get slug
    const vacanteR = await pool.query(
      `SELECT id, slug FROM vacantes WHERE id = $1 AND organization_id = $2`,
      [vacanteId, orgId]
    );
    if (vacanteR.rows.length === 0) {
      return NextResponse.json(null);
    }
    const slug = vacanteR.rows[0].slug;

    // Get all aplicaciones for this vacante with their states
    const { rows: apps } = await pool.query(
      `SELECT a.id, a.estado, a.score_ats, a.created_at,
              c.nombre as candidato_nombre
       FROM aplicaciones a
       JOIN candidatos c ON c.id = a.candidato_id
       WHERE a.vacante_id = $1 AND a.organization_id = $2`,
      [vacanteId, orgId]
    );

    if (apps.length === 0) {
      const insight: PipelineInsight = {
        tipo: 'sin_candidatos',
        titulo: 'No hay candidatos aun',
        descripcion: 'Comparte el enlace del portal publico para recibir postulaciones, o agrega candidatos manualmente.',
        cantidad: 0,
        cta_texto: 'Ir al portal publico',
        cta_href: slug ? `/empleo/${slug}` : `/vacantes/${vacanteId}`,
        prioridad: 'alta',
      };
      return NextResponse.json(insight);
    }

    // 1. Pending score
    const sinScore = apps.filter(a => a.score_ats === null && a.estado !== 'descartado');
    if (sinScore.length > 0) {
      return NextResponse.json({
        tipo: 'pendientes_score',
        titulo: `${sinScore.length} candidato${sinScore.length > 1 ? 's' : ''} sin evaluar`,
        descripcion: 'Tienes candidatos que aun no tienen Score ATS calculado. Calculalo para poder compararlos.',
        cantidad: sinScore.length,
        cta_texto: 'Ver candidatos',
        cta_href: `/vacantes/${vacanteId}/candidatos`,
        prioridad: 'media',
      });
    }

    // 2. Ready for IA interview
    const preseleccionados = apps.filter(a => a.estado === 'preseleccionado');
    if (preseleccionados.length > 0) {
      return NextResponse.json({
        tipo: 'listos_entrevista_ia',
        titulo: `${preseleccionados.length} candidato${preseleccionados.length > 1 ? 's' : ''} listo${preseleccionados.length > 1 ? 's' : ''} para entrevista IA`,
        descripcion: 'Estos candidatos pasaron el corte del Score ATS. Enviales la entrevista telefonica con Dapta.',
        cantidad: preseleccionados.length,
        cta_texto: 'Enviar entrevista IA',
        cta_href: `/vacantes/${vacanteId}/candidatos`,
        prioridad: 'alta',
      });
    }

    // 3. Ready for evaluation
    const entrevistaHumana = apps.filter(a => a.estado === 'entrevista_humana');
    if (entrevistaHumana.length > 0) {
      return NextResponse.json({
        tipo: 'listos_evaluacion',
        titulo: `${entrevistaHumana.length} candidato${entrevistaHumana.length > 1 ? 's' : ''} sin evaluacion tecnica`,
        descripcion: 'La entrevista humana esta completa. El siguiente paso es enviar la evaluacion tecnica.',
        cantidad: entrevistaHumana.length,
        cta_texto: 'Enviar evaluacion tecnica',
        cta_href: `/evaluaciones`,
        prioridad: 'media',
      });
    }

    // 4. Ready for decision
    const evaluados = apps.filter(a => a.estado === 'evaluado');
    if (evaluados.length >= 2) {
      return NextResponse.json({
        tipo: 'listos_decision',
        titulo: 'Listo para tomar la decision?',
        descripcion: `Tienes ${evaluados.length} candidatos completamente evaluados. Revisa el score final y selecciona al mejor.`,
        cantidad: evaluados.length,
        cta_texto: 'Ver comparativa de scores',
        cta_href: `/vacantes/${vacanteId}/candidatos`,
        prioridad: 'alta',
      });
    }

    // 5. Pending documents > 3 days
    const now = Date.now();
    const docsPendientes = apps.filter(a => {
      if (a.estado !== 'documentos_pendientes') return false;
      const created = new Date(a.created_at).getTime();
      return (now - created) > 3 * 24 * 60 * 60 * 1000;
    });
    if (docsPendientes.length > 0) {
      return NextResponse.json({
        tipo: 'listos_documentos',
        titulo: `${docsPendientes.length} candidato${docsPendientes.length > 1 ? 's' : ''} con documentos pendientes`,
        descripcion: 'Llevan mas de 3 dias sin completar el portal de documentos. Considera enviarles un recordatorio.',
        cantidad: docsPendientes.length,
        cta_texto: 'Ver estado de documentos',
        cta_href: `/vacantes/${vacanteId}/candidatos`,
        prioridad: 'media',
      });
    }

    // 6. Ready for contract
    const docsCompletos = apps.filter(a => a.estado === 'documentos_completos');
    if (docsCompletos.length > 0) {
      return NextResponse.json({
        tipo: 'listos_contrato',
        titulo: `${docsCompletos.length} candidato${docsCompletos.length > 1 ? 's' : ''} listo${docsCompletos.length > 1 ? 's' : ''} para contrato`,
        descripcion: 'Los documentos estan completos. El siguiente paso es generar y enviar el contrato.',
        cantidad: docsCompletos.length,
        cta_texto: 'Ir a contratos',
        cta_href: `/contratos`,
        prioridad: 'alta',
      });
    }

    // 7. All good
    return NextResponse.json(null);
  } catch (error) {
    console.error('[GET /api/vacantes/[id]/pipeline-insight]', error);
    return NextResponse.json(null);
  }
}
