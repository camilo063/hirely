import { pool } from '@/lib/db';
import type { ScoreDualResult, EvaluacionHumana } from '@/lib/types/entrevista.types';
import { UUID } from '@/lib/types/common.types';

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

  // 1. Save evaluation in entrevista_humana
  await pool.query(
    `UPDATE entrevistas_humanas SET
       evaluacion = $1,
       score_total = $2,
       fecha_realizada = NOW(),
       estado = 'realizada'
     WHERE id = $3`,
    [JSON.stringify(evaluacion), scoreHumano, entrevistaHumanaId]
  );

  // 2. Get application and IA score
  const appResult = await pool.query(
    `SELECT a.id, a.score_ia, a.peso_ia, a.peso_humano, a.vacante_id, a.candidato_id
     FROM entrevistas_humanas eh
     JOIN aplicaciones a ON a.id = eh.aplicacion_id
     JOIN vacantes v ON v.id = a.vacante_id
     WHERE eh.id = $1 AND v.organization_id = $2`,
    [entrevistaHumanaId, orgId]
  );

  if (appResult.rows.length === 0) throw new Error('Aplicación no encontrada');
  const app = appResult.rows[0];

  // DB stores peso as decimal (0.50 = 50%), use directly
  const pesoIA = app.peso_ia != null ? Number(app.peso_ia) : 0.50;
  const pesoHumano = app.peso_humano != null ? Number(app.peso_humano) : 0.50;
  const scoreIA = Number(app.score_ia) || 0;

  // 3. Calculate dual score
  const scoreFinal = Math.round((scoreIA * pesoIA) + (scoreHumano * pesoHumano));
  const discrepancia = Math.abs(scoreIA - scoreHumano);
  const alertaDiscrepancia = discrepancia > 30;

  // 4. Save in aplicaciones
  await pool.query(
    `UPDATE aplicaciones SET
       score_humano = $1,
       score_final = $2,
       updated_at = NOW()
     WHERE id = $3`,
    [scoreHumano, scoreFinal, app.id]
  );

  // 4b. Recalculate score_final with all available components
  try {
    await recalcularScoreFinal(app.id);
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
    ? `Discrepancia significativa: IA=${scoreIA}, Humano=${scoreHumano} (dif: ${discrepancia}). Score final: ${scoreFinal}`
    : `Score final: ${scoreFinal}/100 (IA: ${scoreIA} x ${Math.round(pesoIA * 100)}% + Humano: ${scoreHumano} x ${Math.round(pesoHumano * 100)}%)`;

  return {
    score_ia: scoreIA,
    score_humano: scoreHumano,
    peso_ia: pesoIA,
    peso_humano: pesoHumano,
    score_final: scoreFinal,
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
    `SELECT a.score_ats, a.score_ia, a.score_humano, a.score_tecnico, a.peso_ia, a.peso_humano
     FROM aplicaciones a
     JOIN vacantes v ON a.vacante_id = v.id
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
