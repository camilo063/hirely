import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { runScoringPipeline } from '@/lib/services/scoring-pipeline.service';
import { getInternalSecret } from '@/lib/utils/internal-secret';

/**
 * POST /api/internal/score-candidato
 *
 * Endpoint INTERNO para ejecutar scoring de un candidato de forma asincrona.
 * Se invoca con fire-and-forget desde procesarAplicacionPortal() para
 * desacoplar el scoring del request HTTP del candidato (que tiene un
 * timeout corto de 15s).
 *
 * Seguridad: protegido por INTERNAL_API_SECRET (env). Si la variable no
 * esta seteada, se deriva un secreto estable a partir de DATABASE_URL +
 * NEXTAUTH_SECRET para mantener consistencia entre invocador y receptor.
 *
 * Body: { candidato_id, vacante_id, organizacion_id, secret }
 */

export const maxDuration = 60;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let candidatoId: string | undefined;
  let vacanteId: string | undefined;
  let organizacionId: string | undefined;

  try {
    const body = await request.json().catch(() => ({}));
    candidatoId = body.candidato_id;
    vacanteId = body.vacante_id;
    organizacionId = body.organizacion_id;
    const secret = body.secret;

    const expectedSecret = getInternalSecret();
    if (!expectedSecret) {
      console.error('[InternalScore] No hay secret configurado (INTERNAL_API_SECRET, DATABASE_URL o NEXTAUTH_SECRET)');
      return NextResponse.json({ success: false, error: 'Configuracion interna invalida' }, { status: 500 });
    }

    if (!secret || typeof secret !== 'string' || secret !== expectedSecret) {
      console.warn('[InternalScore] Intento de acceso con secret invalido');
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    if (!candidatoId || !vacanteId || !organizacionId) {
      return NextResponse.json(
        { success: false, error: 'Faltan candidato_id, vacante_id u organizacion_id' },
        { status: 400 }
      );
    }

    console.log(`[InternalScore] Ejecutando scoring async candidato=${candidatoId} vacante=${vacanteId}`);

    const result = await runScoringPipeline(candidatoId, vacanteId, organizacionId);

    // Limpia el error y suma intento
    await pool.query(
      `UPDATE aplicaciones
         SET score_ats_error = NULL,
             score_ats_intentos = COALESCE(score_ats_intentos, 0) + 1
       WHERE candidato_id = $1 AND vacante_id = $2`,
      [candidatoId, vacanteId]
    );

    console.log(`[InternalScore] Scoring OK candidato=${candidatoId} score=${result.score_total}`);

    return NextResponse.json({
      success: true,
      score_total: result.score_total,
      pasa_corte: result.pasa_corte,
    });
  } catch (error: any) {
    const msg: string = (error?.message || 'Error desconocido en scoring').toString();
    console.error('[InternalScore] Error en pipeline:', error);

    if (candidatoId && vacanteId) {
      try {
        await pool.query(
          `UPDATE aplicaciones
             SET score_ats_error = $1,
                 score_ats_intentos = COALESCE(score_ats_intentos, 0) + 1
           WHERE candidato_id = $2 AND vacante_id = $3`,
          [msg.substring(0, 500), candidatoId, vacanteId]
        );
      } catch (dbError) {
        console.error('[InternalScore] Error guardando score_ats_error:', dbError);
      }
    }

    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
