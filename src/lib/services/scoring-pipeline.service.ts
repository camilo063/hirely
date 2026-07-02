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
  const t0 = Date.now();
  console.log(`[Scoring] Inicio pipeline candidato=${candidatoId} vacante=${vacanteId} org=${orgId}`);

  // 1. Obtener candidato y vacante
  const [candidatoResult, vacanteResult] = await Promise.all([
    pool.query(
      `SELECT * FROM candidatos WHERE id = $1 AND organization_id = $2`,
      [candidatoId, orgId]
    ),
    pool.query(
      `SELECT v.*, os.umbral_preseleccion as umbral_org
       FROM vacantes v
       LEFT JOIN org_settings os ON os.organization_id = v.organization_id
       WHERE v.id = $1 AND v.organization_id = $2`,
      [vacanteId, orgId]
    ),
  ]);

  if (candidatoResult.rows.length === 0) throw new Error('Candidato no encontrado');
  if (vacanteResult.rows.length === 0) throw new Error('Vacante no encontrada');

  const candidato = candidatoResult.rows[0];
  const vacante = vacanteResult.rows[0];
  console.log(`[Scoring] Candidato: ${candidato.nombre} ${candidato.apellido || ''} | cv_url=${!!candidato.cv_url} | linkedin=${!!candidato.linkedin_url}`);
  console.log(`[Scoring] Vacante: ${vacante.titulo}`);

  // 2. Parsear CV si no esta parseado o esta incompleto
  let cvParsed = candidato.cv_parsed;
  const confianzaBaja = typeof cvParsed?.confianza === 'number' && cvParsed.confianza < 0.5;
  const needsParsing = !cvParsed?.parsed_at ||
                       !cvParsed?.habilidades_tecnicas?.length ||
                       cvParsed?.parser_version === '1.0-fallback' ||
                       cvParsed?.parser_version === '1.0-minimal' ||
                       confianzaBaja;

  if (needsParsing) {
    console.log(`[Scoring] Re-parseo necesario: parser_version=${cvParsed?.parser_version}, confianza=${cvParsed?.confianza}, tiene_cv_url=${!!candidato.cv_url}`);
    if (candidato.cv_url) {
      // CRITICO: si hay cv_url, el parseo con Claude DEBE funcionar.
      // No caer al fallback silencioso (parseCVFromLinkedIn -> buildCVFromRawData)
      // porque eso genera scores basura sin que el admin se entere.
      // Excepcion: si Claude no esta configurado, usar fallback (no es un bug, es config faltante).
      try {
        console.log(`[Scoring] Descargando PDF desde ${String(candidato.cv_url).substring(0, 80)}...`);
        const pdfBase64 = await pdfUrlToBase64(candidato.cv_url);
        console.log(`[Scoring] PDF descargado (${Math.round(pdfBase64.length / 1024)}KB base64), invocando Claude para parseo`);
        cvParsed = await parseCVFromPDF(pdfBase64, candidatoId, orgId);
        console.log(`[Scoring] CV parseado con Claude: confianza=${cvParsed?.confianza}, habilidades=${cvParsed?.habilidades_tecnicas?.length}, version=${cvParsed?.parser_version}`);
      } catch (error: any) {
        const msg = error?.message || '';
        if (msg.includes('ANTHROPIC_API_KEY')) {
          // Caso especial: Claude no configurado -> permitir fallback con warning
          console.warn(`[Scoring] Claude API no configurada — usando datos del formulario para ${candidatoId}`);
          cvParsed = await parseCVFromLinkedIn(candidatoId, orgId);
        } else {
          // Cualquier otro error: PROPAGAR para que quede en score_ats_error
          console.error(`[Scoring] ERROR CRITICO parseando PDF de ${candidatoId} (cv_url=${String(candidato.cv_url).substring(0, 80)}):`, error);
          throw new Error(`Error parseando CV PDF: ${msg || String(error)}`);
        }
      }
    } else if (candidato.fuente === 'linkedin' || candidato.linkedin_url) {
      console.log(`[Scoring] Sin cv_url, candidato con datos LinkedIn -> parseCVFromLinkedIn`);
      cvParsed = await parseCVFromLinkedIn(candidatoId, orgId);
    } else {
      console.warn(`[Scoring] ADVERTENCIA: candidato ${candidatoId} sin cv_url ni LinkedIn. Score sera basado solo en datos del formulario.`);
      cvParsed = await parseCVFromLinkedIn(candidatoId, orgId);
    }
  } else {
    console.log(`[Scoring] CV ya parseado correctamente (version=${cvParsed?.parser_version}, confianza=${cvParsed?.confianza}), saltando re-parseo`);
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

  // 3. Calcular score (umbral efectivo: vacante.score_minimo > org.umbral_preseleccion > 70)
  const scoreResult = calculateATSScore(
    cvParsed,
    vacante,
    vacante.umbral_org != null ? Number(vacante.umbral_org) : null
  );
  console.log(`[Scoring] Score calculado: ${scoreResult.score_total}/100 | pasa_corte=${scoreResult.pasa_corte} | recomendacion=${scoreResult.recomendacion}`);

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
       score_ats_error = NULL,
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
  console.log(`[Scoring] Score guardado en BD (estado=${nuevoEstado}) en ${Date.now() - t0}ms`);

  // 4b. Recalculate score_final with all available components
  try {
    const { recalcularScoreFinal } = await import('./scoring-dual.service');
    const appIdResult = await pool.query(
      `SELECT id FROM aplicaciones WHERE vacante_id = $1 AND candidato_id = $2`,
      [vacanteId, candidatoId]
    );
    if (appIdResult.rows[0]) {
      await recalcularScoreFinal(appIdResult.rows[0].id);
    }
  } catch (err) {
    console.error('[Scoring Pipeline] Error recalculando score_final:', err);
  }

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
 * Re-score masivo: recalcula scores de candidatos de una vacante.
 * Por defecto solo procesa aplicaciones sin score o con error de scoring.
 * Si `force=true`, recalcula TODOS los candidatos de la vacante.
 */
export async function rescoreAllCandidatos(
  vacanteId: string,
  orgId: string,
  options: { force?: boolean } = {}
): Promise<{
  total: number;
  exitosos: number;
  errores: number;
  detalles: Array<{ candidato_id: string; ok: boolean; error?: string; score?: number }>;
}> {
  const force = options.force === true;

  const query = force
    ? `SELECT a.candidato_id FROM aplicaciones a
       JOIN candidatos c ON c.id = a.candidato_id
       WHERE a.vacante_id = $1 AND c.organization_id = $2`
    : `SELECT a.candidato_id FROM aplicaciones a
       JOIN candidatos c ON c.id = a.candidato_id
       WHERE a.vacante_id = $1 AND c.organization_id = $2
         AND (
           a.score_ats IS NULL
           OR a.score_ats_error IS NOT NULL
           OR (
             c.cv_url IS NOT NULL
             AND (
               c.cv_parsed->>'parser_version' = '1.0-fallback'
               OR c.cv_parsed->>'parser_version' = '1.0-minimal'
               OR (c.cv_parsed->>'confianza')::numeric < 0.5
             )
           )
         )`;

  const aplicaciones = await pool.query(query, [vacanteId, orgId]);

  console.log(`[Scoring] Iniciando rescoring masivo vacante=${vacanteId} force=${force} total=${aplicaciones.rows.length}`);

  let exitosos = 0;
  let errores = 0;
  const detalles: Array<{ candidato_id: string; ok: boolean; error?: string; score?: number }> = [];

  // Procesar en lotes de 5 para no saturar Claude API
  const LOTE = 5;
  for (let i = 0; i < aplicaciones.rows.length; i += LOTE) {
    const slice = aplicaciones.rows.slice(i, i + LOTE);
    const results = await Promise.allSettled(
      slice.map((row) => runScoringPipeline(row.candidato_id, vacanteId, orgId))
    );

    for (let j = 0; j < slice.length; j++) {
      const candidatoId = slice[j].candidato_id;
      const r = results[j];
      if (r.status === 'fulfilled') {
        exitosos++;
        detalles.push({ candidato_id: candidatoId, ok: true, score: r.value.score_total });
        try {
          await pool.query(
            `UPDATE aplicaciones SET score_ats_intentos = COALESCE(score_ats_intentos, 0) + 1
             WHERE candidato_id = $1 AND vacante_id = $2`,
            [candidatoId, vacanteId]
          );
        } catch { /* ignore */ }
      } else {
        errores++;
        const msg = (r.reason?.message || 'Error desconocido').toString();
        detalles.push({ candidato_id: candidatoId, ok: false, error: msg });
        console.error(`[Scoring] Error rescoring candidato=${candidatoId}:`, r.reason);
        try {
          await pool.query(
            `UPDATE aplicaciones SET
               score_ats_error = $1,
               score_ats_intentos = COALESCE(score_ats_intentos, 0) + 1
             WHERE candidato_id = $2 AND vacante_id = $3`,
            [msg.substring(0, 500), candidatoId, vacanteId]
          );
        } catch { /* ignore */ }
      }
    }

    // Pequeno delay entre lotes para no saturar Claude
    if (i + LOTE < aplicaciones.rows.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`[Scoring] Rescoring masivo completado: ${exitosos} OK, ${errores} errores`);

  return { total: aplicaciones.rows.length, exitosos, errores, detalles };
}
