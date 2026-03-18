import { pool } from '@/lib/db';
import { parseCVFromPDF, parseCVFromLinkedIn } from './cv-parser.service';
import { calculateATSScore } from './scoring-ats.service';
import { pdfUrlToBase64 } from '@/lib/utils/pdf-extract';
import type { ATSScoreResult } from '@/lib/types/scoring.types';

/**
 * Orquestador del pipeline de scoring.
 * Coordina: Parse CV -> Score -> Update estado -> Ranking.
 *
 * Se triggerea automaticamente cuando:
 * 1. Un candidato es sincronizado desde LinkedIn (linkedin-sync.service.ts)
 * 2. Se sube un CV manualmente
 * 3. Se recalculan scores (cambio de criterios en la vacante)
 */

/**
 * Ejecuta el pipeline completo para un candidato en una vacante.
 */
export async function runScoringPipeline(
  candidatoId: string,
  vacanteId: string,
  orgId: string
): Promise<ATSScoreResult> {
  // 1. Obtener candidato y vacante
  const [candidatoResult, vacanteResult] = await Promise.all([
    pool.query(
      `SELECT * FROM candidatos WHERE id = $1 AND organization_id = $2`,
      [candidatoId, orgId]
    ),
    pool.query(
      `SELECT * FROM vacantes WHERE id = $1 AND organization_id = $2`,
      [vacanteId, orgId]
    ),
  ]);

  if (candidatoResult.rows.length === 0) throw new Error('Candidato no encontrado');
  if (vacanteResult.rows.length === 0) throw new Error('Vacante no encontrada');

  const candidato = candidatoResult.rows[0];
  const vacante = vacanteResult.rows[0];

  // 2. Parsear CV si no esta parseado o esta incompleto
  let cvParsed = candidato.cv_parsed;
  const needsParsing = !cvParsed?.parsed_at ||
                       !cvParsed?.habilidades_tecnicas?.length ||
                       cvParsed?.parser_version === '1.0-fallback';

  if (needsParsing) {
    if (candidato.cv_url) {
      try {
        const pdfBase64 = await pdfUrlToBase64(candidato.cv_url);
        cvParsed = await parseCVFromPDF(pdfBase64, candidatoId, orgId);
      } catch (error: any) {
        const msg = error.message || '';
        if (msg.includes('ANTHROPIC_API_KEY')) {
          console.warn(`[Scoring Pipeline] Claude API no configurada — usando scoring basico para ${candidatoId}`);
        } else {
          console.error(`[Scoring Pipeline] Error parseando PDF de ${candidatoId}:`, error);
        }
        cvParsed = await parseCVFromLinkedIn(candidatoId, orgId);
      }
    } else {
      cvParsed = await parseCVFromLinkedIn(candidatoId, orgId);
    }
  }

  if (!cvParsed || !cvParsed.nombre) {
    // Last resort: build minimal CV data from candidato fields
    console.warn(`[Scoring Pipeline] Sin datos parseados para ${candidatoId}, construyendo datos minimos`);
    cvParsed = {
      nombre: candidato.nombre || 'Sin nombre',
      email: candidato.email,
      habilidades_tecnicas: Array.isArray(candidato.habilidades) ? candidato.habilidades : [],
      experiencia_total_anos: candidato.experiencia_anos || 0,
      nivel_educativo_max: candidato.nivel_educativo || null,
      idiomas: Array.isArray(candidato.idiomas) ? candidato.idiomas : [],
      keywords: Array.isArray(candidato.habilidades) ? candidato.habilidades : [],
      parsed_at: new Date().toISOString(),
      parser_version: '1.0-minimal',
      confianza: 0.2,
    } as any;
  }

  // 3. Calcular score
  const scoreResult = calculateATSScore(cvParsed, vacante);

  // 4. Guardar score, breakdown y actualizar estado
  const nuevoEstado = scoreResult.pasa_corte ? 'en_revision' : 'descartado';
  const nota = scoreResult.pasa_corte
    ? `Score ATS: ${scoreResult.score_total}/100 — ${scoreResult.recomendacion.toUpperCase()}`
    : `Descartado por score ATS: ${scoreResult.score_total}/100 (minimo: ${scoreResult.score_minimo})`;

  await pool.query(
    `UPDATE aplicaciones SET
       score_ats = $1,
       score_ats_breakdown = $2,
       score_ats_resumen = $3,
       scored_at = $4,
       estado = CASE
         WHEN estado = 'nuevo' THEN $5
         ELSE estado
       END,
       notas = CASE
         WHEN notas IS NULL OR notas = '' THEN $6
         ELSE notas || E'\n' || $6
       END,
       updated_at = NOW()
     WHERE vacante_id = $7 AND candidato_id = $8`,
    [
      scoreResult.score_total,
      JSON.stringify(scoreResult.breakdown),
      scoreResult.resumen,
      scoreResult.scored_at,
      nuevoEstado,
      nota,
      vacanteId,
      candidatoId,
    ]
  );

  // 5. Log de actividad
  await pool.query(
    `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
     VALUES ($1, 'aplicacion', $2, 'ats_scored', $3)`,
    [orgId, candidatoId, JSON.stringify({
      score: scoreResult.score_total,
      pasa_corte: scoreResult.pasa_corte,
      recomendacion: scoreResult.recomendacion,
      breakdown_resumen: {
        experiencia: scoreResult.breakdown.experiencia.score,
        habilidades: scoreResult.breakdown.habilidades.score,
        educacion: scoreResult.breakdown.educacion.score,
        idiomas: scoreResult.breakdown.idiomas.score,
        certificaciones: scoreResult.breakdown.certificaciones.score,
        keywords: scoreResult.breakdown.keywords.score,
      },
    })]
  );

  return scoreResult;
}

/**
 * Re-score masivo: recalcula scores de TODOS los candidatos de una vacante.
 * Util cuando el reclutador cambia los criterios de evaluacion o el score minimo.
 */
export async function rescoreAllCandidatos(vacanteId: string, orgId: string): Promise<{
  total: number;
  exitosos: number;
  errores: number;
}> {
  const aplicaciones = await pool.query(
    `SELECT a.candidato_id FROM aplicaciones a
     JOIN candidatos c ON c.id = a.candidato_id
     WHERE a.vacante_id = $1 AND c.organization_id = $2`,
    [vacanteId, orgId]
  );

  let exitosos = 0;
  let errores = 0;

  for (const row of aplicaciones.rows) {
    try {
      await runScoringPipeline(row.candidato_id, vacanteId, orgId);
      exitosos++;
    } catch (error) {
      errores++;
      console.error(`Error rescoring candidato ${row.candidato_id}:`, error);
    }
  }

  return { total: aplicaciones.rows.length, exitosos, errores };
}
