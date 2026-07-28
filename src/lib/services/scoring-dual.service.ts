import { pool } from '@/lib/db';
import type { ScoreDualResult, EvaluacionHumana } from '@/lib/types/entrevista.types';
import { UUID } from '@/lib/types/common.types';
import { NotFoundError } from '@/lib/utils/errors';

/**
 * Scoring Dual: combines IA + Human scores.
 *
 * Formula: Score Final = (Score IA x Peso IA) + (Score Humano x Peso Humano)
 * Default: 50% / 50%
 *
 * Human score comes in scale 1-10 per criterion, converted to 0-100.
 */

/**
 * Recalculates score_final for an aplicacion based on all available partial scores.
 * Weights: ATS 20%, IA 25%, Tecnico 30%, Humano 25%.
 * Adjusts dynamically when some scores are missing.
 * Safe to call from anywhere — no-ops if aplicacion not found or no scores exist.
 */
export async function recalcularScoreFinal(aplicacionId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT score_ats, score_ia, score_tecnico, score_humano FROM aplicaciones WHERE id = $1`,
    [aplicacionId]
  );
  if (!rows[0]) return;

  const { score_ats, score_ia, score_tecnico, score_humano } = rows[0];

  const scores = [
    { valor: score_ats, peso: 0.20 },
    { valor: score_ia, peso: 0.25 },
    { valor: score_tecnico, peso: 0.30 },
    { valor: score_humano, peso: 0.25 },
  ].filter(s => s.valor !== null && s.valor !== undefined);

  if (scores.length === 0) return;

  const pesoTotal = scores.reduce((sum, s) => sum + s.peso, 0);
  const scoreFinal = scores.reduce((sum, s) => sum + (s.valor * s.peso / pesoTotal), 0);

  await pool.query(
    `UPDATE aplicaciones SET score_final = $1, updated_at = NOW() WHERE id = $2`,
    [Math.round(scoreFinal), aplicacionId]
  );
}

export function calcularScoreHumano(evaluacion: EvaluacionHumana): number {
  const criterios = [
    evaluacion.competencia_tecnica.score,
    evaluacion.habilidades_blandas.score,
    evaluacion.fit_cultural.score,
    evaluacion.potencial_crecimiento.score,
    evaluacion.presentacion_personal.score,
  ];
  const promedio = criterios.reduce((a, b) => a + b, 0) / criterios.length;
  return Math.round(promedio * 10); // Scale 1-10 -> 0-100
}

export async function guardarEvaluacionHumana(
  entrevistaHumanaId: string,
  evaluacion: EvaluacionHumana,
  orgId: string
): Promise<ScoreDualResult> {
  const scoreHumano = calcularScoreHumano(evaluacion);

  // 1. Verificar pertenencia ANTES de escribir nada.
  //
  // El UPDATE de la evaluacion iba primero y sin filtro de organizacion, y la
  // comprobacion de pertenencia venia despues. Como no hay transaccion (pg en
  // autocommit), el `throw` posterior no revertia nada: una sesion de cualquier
  // empresa podia sobrescribir la evaluacion, el score y el estado de una
  // entrevista ajena con solo poner su id en la URL.
  // Los pesos salen de la aplicacion y, si no los tiene, de la configuracion de
  // la organizacion. Antes solo se miraba la aplicacion y se caia a 50/50 fijo,
  // asi que Configuracion > Scoring era una pantalla que guardaba valores que
  // nadie leia jamas.
  const appResult = await pool.query(
    `SELECT a.id, a.score_ia, a.vacante_id, a.candidato_id,
            COALESCE(a.peso_ia,     os.peso_ia     / 100.0) AS peso_ia,
            COALESCE(a.peso_humano, os.peso_humano / 100.0) AS peso_humano
     FROM entrevistas_humanas eh
     JOIN aplicaciones a ON a.id = eh.aplicacion_id
     JOIN vacantes v ON v.id = a.vacante_id
     LEFT JOIN org_settings os ON os.organization_id = v.organization_id
     WHERE eh.id = $1 AND v.organization_id = $2`,
    [entrevistaHumanaId, orgId]
  );

  if (appResult.rows.length === 0) throw new NotFoundError('Entrevista', entrevistaHumanaId);
  const app = appResult.rows[0];

  // 2. Save evaluation in entrevista_humana (ya validada la pertenencia)
  await pool.query(
    `UPDATE entrevistas_humanas SET
       evaluacion = $1,
       score_total = $2,
       fecha_realizada = NOW(),
       estado = 'realizada'
     WHERE id = $3`,
    [JSON.stringify(evaluacion), scoreHumano, entrevistaHumanaId]
  );

  // DB stores peso as decimal (0.50 = 50%), use directly
  const pesoIA = app.peso_ia != null ? Number(app.peso_ia) : 0.50;
  const pesoHumano = app.peso_humano != null ? Number(app.peso_humano) : 0.50;
  // `score_ia` puede no existir todavia (el candidato aun no hizo la entrevista
  // IA, o la organizacion no usa ese modulo). Tratarlo como 0 producia una
  // "discrepancia significativa: IA=0, Humano=82" que no significaba nada y
  // ademas hundia el score final.
  const tieneScoreIA = app.score_ia !== null && app.score_ia !== undefined;
  const scoreIA = tieneScoreIA ? Number(app.score_ia) : 0;

  // 3. Calculate dual score
  const scoreFinal = tieneScoreIA
    ? Math.round(scoreIA * pesoIA + scoreHumano * pesoHumano)
    : Math.round(scoreHumano); // sin componente IA, manda la evaluacion humana
  const discrepancia = tieneScoreIA ? Math.abs(scoreIA - scoreHumano) : 0;
  const alertaDiscrepancia = tieneScoreIA && discrepancia > 30;

  // 4. Save in aplicaciones
  await pool.query(
    `UPDATE aplicaciones SET
       score_humano = $1,
       score_final = $2,
       updated_at = NOW()
     WHERE id = $3`,
    [scoreHumano, scoreFinal, app.id]
  );

  // 4b. Recalculate score_final with all available components.
  //
  // Este recalculo considera tambien el score ATS y el tecnico, asi que el valor
  // final NO es el de la linea 4. La respuesta debe devolver el valor
  // DEFINITIVO: antes se contestaba el intermedio (se observo 42 en la respuesta
  // y 93 en la base), y el reclutador veia un score y una alerta de discrepancia
  // que no correspondian con lo que quedaba guardado.
  let scoreFinalDefinitivo = scoreFinal;
  try {
    await recalcularScoreFinal(app.id);
    const persistido = await pool.query(
      `SELECT score_final FROM aplicaciones WHERE id = $1`,
      [app.id]
    );
    if (persistido.rows[0]?.score_final != null) {
      scoreFinalDefinitivo = Number(persistido.rows[0].score_final);
    }
  } catch (err) {
    console.error('[Scoring Dual] Error recalculando score_final:', err);
  }

  // 5. Log
  await pool.query(
    `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
     VALUES ($1, 'aplicacion', $2, 'scoring_dual_completed', $3)`,
    [orgId, app.id, JSON.stringify({ scoreIA, scoreHumano, scoreFinal, discrepancia, alertaDiscrepancia })]
  );

  const resumen = alertaDiscrepancia
    ? `Discrepancia significativa: IA=${scoreIA}, Humano=${scoreHumano} (dif: ${discrepancia}). Score final: ${scoreFinalDefinitivo}`
    : `Score final: ${scoreFinalDefinitivo}/100 (IA: ${scoreIA} x ${Math.round(pesoIA * 100)}% + Humano: ${scoreHumano} x ${Math.round(pesoHumano * 100)}%)`;

  return {
    score_ia: scoreIA,
    score_humano: scoreHumano,
    peso_ia: pesoIA,
    peso_humano: pesoHumano,
    score_final: scoreFinalDefinitivo,
    discrepancia,
    alerta_discrepancia: alertaDiscrepancia,
    resumen,
  };
}

/**
 * Calculate score final with up to 4 components:
 * ATS (20%) + IA (25%) + Humano (25%) + Técnico (30%)
 * Weights adjust dynamically based on which scores exist.
 */
export async function calculateScoreDual(orgId: UUID, aplicacionId: UUID) {
  const appResult = await pool.query(
    `SELECT a.score_ats, a.score_ia, a.score_humano, a.score_tecnico,
            COALESCE(a.peso_ia,     os.peso_ia     / 100.0) AS peso_ia,
            COALESCE(a.peso_humano, os.peso_humano / 100.0) AS peso_humano
     FROM aplicaciones a
     JOIN vacantes v ON a.vacante_id = v.id
     LEFT JOIN org_settings os ON os.organization_id = v.organization_id
     WHERE a.id = $1 AND v.organization_id = $2`,
    [aplicacionId, orgId]
  );

  if (appResult.rows.length === 0) throw new Error('Aplicacion no encontrada');

  const { score_ats, score_ia, score_humano, score_tecnico, peso_ia, peso_humano } = appResult.rows[0];

  // Build components with available scores
  const components: { nombre: string; valor: number; peso: number }[] = [];
  const sAts = score_ats != null ? Number(score_ats) : null;
  const sIa = score_ia != null ? Number(score_ia) : null;
  const sHumano = score_humano != null ? Number(score_humano) : null;
  const sTecnico = score_tecnico != null ? Number(score_tecnico) : null;

  // Default weights: ATS 20%, IA 25%, Humano 25%, Técnico 30%
  if (sAts !== null) components.push({ nombre: 'Score ATS', valor: sAts, peso: 20 });
  if (sIa !== null) components.push({ nombre: 'Score IA (Dapta)', valor: sIa, peso: 25 });
  if (sHumano !== null) components.push({ nombre: 'Score Humano', valor: sHumano, peso: 25 });
  if (sTecnico !== null) components.push({ nombre: 'Score Técnico', valor: sTecnico, peso: 30 });

  let score_final: number;
  if (components.length === 0) {
    score_final = 0;
  } else {
    // Normalize weights to sum to 100
    const totalPeso = components.reduce((s, c) => s + c.peso, 0);
    score_final = Math.round(
      components.reduce((s, c) => s + c.valor * (c.peso / totalPeso), 0)
    );
  }

  await pool.query(
    `UPDATE aplicaciones SET score_final = $2, updated_at = NOW() WHERE id = $1`,
    [aplicacionId, score_final]
  );

  return {
    score_final,
    score_ats: sAts,
    score_ia: sIa,
    score_humano: sHumano,
    score_tecnico: sTecnico,
    peso_ia: peso_ia != null ? Number(peso_ia) : 0.50,
    peso_humano: peso_humano != null ? Number(peso_humano) : 0.50,
    detalles: {
      formula: components.map(c => `${c.nombre}: ${c.valor} x ${c.peso}%`).join(' + ') + ` = ${score_final}`,
      componentes: components,
    },
  };
}

export async function batchCalculateScoreDual(orgId: UUID, vacanteId: UUID): Promise<number> {
  const aplicaciones = await pool.query(
    `SELECT a.id FROM aplicaciones a
    JOIN vacantes v ON a.vacante_id = v.id
    WHERE a.vacante_id = $1 AND v.organization_id = $2
    AND (a.score_ia IS NOT NULL OR a.score_humano IS NOT NULL)`,
    [vacanteId, orgId]
  );

  let calculated = 0;
  for (const app of aplicaciones.rows) {
    await calculateScoreDual(orgId, app.id);
    calculated++;
  }

  return calculated;
}
