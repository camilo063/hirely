import { pool } from '../db';
import { UUID } from '../types/common.types';
import type {
  CVParsedData,
  CriteriosEvaluacion,
  ATSScoreResult,
  ScoreBreakdown,
  DimensionScore,
} from '@/lib/types/scoring.types';
import { DEFAULT_CRITERIOS } from '@/lib/types/scoring.types';
import type { Vacante } from '@/lib/types/vacante.types';
import { NotFoundError } from '../utils/errors';

/**
 * Motor de Scoring ATS.
 *
 * Compara los datos parseados del CV (CVParsedData) contra
 * los criterios de evaluacion de la vacante para generar
 * un score de compatibilidad 0-100.
 *
 * IMPORTANTE: Este scoring es deterministico y NO usa IA.
 * Trabaja con los datos ya parseados. Esto permite:
 * - Re-calcular scores sin costo de API
 * - Resultados consistentes y auditables
 * - Re-scoring instantaneo cuando cambian los criterios
 */

/**
 * Calcula el score ATS de un candidato contra una vacante.
 */
export function calculateATSScore(
  cvData: CVParsedData,
  vacante: Vacante
): ATSScoreResult {
  // Obtener criterios de evaluacion (custom o defaults)
  const rawCriterios = vacante.criterios_evaluacion;
  let criterios: CriteriosEvaluacion = { ...DEFAULT_CRITERIOS };

  if (rawCriterios && typeof rawCriterios === 'object' && !Array.isArray(rawCriterios)) {
    // Flat object format: { experiencia: 0.30, habilidades: 0.25, ... }
    const obj = rawCriterios as Record<string, number>;
    if ('experiencia' in obj) criterios.experiencia = obj.experiencia;
    if ('habilidades' in obj) criterios.habilidades = obj.habilidades;
    if ('educacion' in obj) criterios.educacion = obj.educacion;
    if ('idiomas' in obj) criterios.idiomas = obj.idiomas;
    if ('certificaciones' in obj) criterios.certificaciones = obj.certificaciones;
    if ('keywords' in obj) criterios.keywords = obj.keywords;
  }

  // Normalizar pesos para que sumen 1.0
  const sumaPesos = Object.values(criterios).reduce((a, b) => a + b, 0);
  const pesosNormalizados: CriteriosEvaluacion = {
    experiencia: criterios.experiencia / sumaPesos,
    habilidades: criterios.habilidades / sumaPesos,
    educacion: criterios.educacion / sumaPesos,
    idiomas: criterios.idiomas / sumaPesos,
    certificaciones: criterios.certificaciones / sumaPesos,
    keywords: criterios.keywords / sumaPesos,
  };

  // Extraer datos de la vacante para comparacion
  const vacanteData = {
    habilidades_requeridas: extractSkillNames(vacante.habilidades_requeridas),
    experiencia_minima: vacante.experiencia_minima || 0,
    nivel_estudios: vacante.nivel_estudios || '',
    idiomas_requeridos: extractIdiomasFromCriterios(vacante.criterios_evaluacion),
    certificaciones_requeridas: extractCertificacionesFromCriterios(vacante.criterios_evaluacion),
    keywords: extractKeywordsFromVacante(vacante),
  };

  // Calcular score por dimension
  const breakdown: ScoreBreakdown = {
    experiencia: scoreExperiencia(cvData, vacanteData.experiencia_minima, pesosNormalizados.experiencia),
    habilidades: scoreHabilidades(cvData, vacanteData.habilidades_requeridas, pesosNormalizados.habilidades),
    educacion: scoreEducacion(cvData, vacanteData.nivel_estudios, pesosNormalizados.educacion),
    idiomas: scoreIdiomas(cvData, vacanteData.idiomas_requeridos, pesosNormalizados.idiomas),
    certificaciones: scoreCertificaciones(cvData, vacanteData.certificaciones_requeridas, pesosNormalizados.certificaciones),
    keywords: scoreKeywords(cvData, vacanteData.keywords, pesosNormalizados.keywords),
  };

  // Score total = suma de ponderados
  const score_total = Math.round(
    breakdown.experiencia.ponderado +
    breakdown.habilidades.ponderado +
    breakdown.educacion.ponderado +
    breakdown.idiomas.ponderado +
    breakdown.certificaciones.ponderado +
    breakdown.keywords.ponderado
  );

  const score_minimo = vacante.score_minimo || 70;
  const pasa_corte = score_total >= score_minimo;

  let recomendacion: ATSScoreResult['recomendacion'];
  if (score_total >= 85) recomendacion = 'alta';
  else if (score_total >= 70) recomendacion = 'media';
  else if (score_total >= 50) recomendacion = 'baja';
  else recomendacion = 'no_apto';

  const resumen = generarResumen(breakdown, score_total, score_minimo, pasa_corte);

  return {
    score_total,
    breakdown,
    pasa_corte,
    score_minimo,
    resumen,
    recomendacion,
    scored_at: new Date().toISOString(),
  };
}

// --- FUNCIONES DE SCORING POR DIMENSION ---

function scoreExperiencia(cv: CVParsedData, experienciaMinima: number, peso: number): DimensionScore {
  let score = 0;
  const matches: string[] = [];
  const gaps: string[] = [];

  const anosExperiencia = cv.experiencia_total_anos || 0;

  if (experienciaMinima === 0) {
    score = Math.min(100, 60 + anosExperiencia * 5);
    matches.push(`${anosExperiencia} ano(s) de experiencia`);
  } else if (anosExperiencia >= experienciaMinima) {
    const exceso = anosExperiencia - experienciaMinima;
    score = Math.min(100, 70 + exceso * 10);
    matches.push(`${anosExperiencia} ano(s) de experiencia (req: ${experienciaMinima})`);
  } else if (anosExperiencia >= experienciaMinima * 0.7) {
    score = 40 + (anosExperiencia / experienciaMinima) * 30;
    gaps.push(`Experiencia: ${anosExperiencia} ano(s) vs. ${experienciaMinima} requerido(s)`);
  } else {
    score = Math.max(10, (anosExperiencia / experienciaMinima) * 40);
    gaps.push(`Experiencia insuficiente: ${anosExperiencia} ano(s) vs. ${experienciaMinima} requerido(s)`);
  }

  if (cv.experiencia.length >= 3) {
    score = Math.min(100, score + 5);
    matches.push(`${cv.experiencia.length} posiciones previas`);
  }

  return {
    score: Math.round(score),
    peso,
    ponderado: Math.round(score * peso),
    detalle: anosExperiencia >= experienciaMinima
      ? `Cumple con la experiencia requerida (${anosExperiencia}/${experienciaMinima} anos)`
      : `Experiencia por debajo del minimo (${anosExperiencia}/${experienciaMinima} anos)`,
    matches,
    gaps,
  };
}

function scoreHabilidades(cv: CVParsedData, requeridas: string[], peso: number): DimensionScore {
  const matches: string[] = [];
  const gaps: string[] = [];

  if (requeridas.length === 0) {
    return { score: 80, peso, ponderado: Math.round(80 * peso), detalle: 'Sin habilidades especificas requeridas', matches: [], gaps: [] };
  }

  const candidatoSkills = [
    ...cv.habilidades_tecnicas,
    ...cv.keywords,
    ...cv.experiencia.flatMap(e => e.tecnologias || []),
  ].map(s => s.toLowerCase().trim());

  const candidatoSkillsSet = new Set(candidatoSkills);

  let matchCount = 0;
  for (const req of requeridas) {
    const reqLower = req.toLowerCase().trim();
    const found = candidatoSkillsSet.has(reqLower) ||
      candidatoSkills.some(s =>
        s.includes(reqLower) || reqLower.includes(s) ||
        normalizeSkillName(s) === normalizeSkillName(reqLower)
      );

    if (found) {
      matchCount++;
      matches.push(req);
    } else {
      gaps.push(req);
    }
  }

  const matchRatio = matchCount / requeridas.length;
  const score = Math.round(matchRatio * 100);

  return {
    score,
    peso,
    ponderado: Math.round(score * peso),
    detalle: `${matchCount}/${requeridas.length} habilidades requeridas encontradas`,
    matches,
    gaps,
  };
}

function scoreEducacion(cv: CVParsedData, nivelRequerido: string, peso: number): DimensionScore {
  const matches: string[] = [];
  const gaps: string[] = [];

  const niveles: Record<string, number> = {
    'bachiller': 1, 'bachillerato': 1,
    'tecnologo': 2, 'tecnico': 2, 'tecnólogo': 2, 'técnico': 2,
    'profesional': 3, 'universitario': 3, 'pregrado': 3, 'licenciatura': 3,
    'especializacion': 4, 'especialización': 4, 'postgrado': 4,
    'maestria': 5, 'maestría': 5, 'master': 5, 'magister': 5,
    'doctorado': 6, 'phd': 6, 'doctorate': 6,
  };

  const nivelCandidato = niveles[cv.nivel_educativo_max?.toLowerCase() || ''] || 0;
  const nivelReq = niveles[nivelRequerido?.toLowerCase() || ''] || 0;

  if (nivelReq === 0) {
    const s = Math.min(100, 70 + nivelCandidato * 5);
    return { score: s, peso, ponderado: Math.round(s * peso), detalle: 'Sin requisito educativo especifico', matches: [cv.nivel_educativo_max || 'No especificado'], gaps: [] };
  }

  let score: number;
  if (nivelCandidato >= nivelReq) {
    score = Math.min(100, 80 + (nivelCandidato - nivelReq) * 10);
    matches.push(`${cv.nivel_educativo_max} (cumple o supera ${nivelRequerido})`);
  } else if (nivelCandidato >= nivelReq - 1) {
    score = 50;
    gaps.push(`Nivel educativo: ${cv.nivel_educativo_max || 'No especificado'} vs. ${nivelRequerido} requerido`);
  } else {
    score = 20;
    gaps.push(`Nivel educativo inferior: ${cv.nivel_educativo_max || 'No especificado'} vs. ${nivelRequerido} requerido`);
  }

  if (cv.educacion.length > 1) {
    score = Math.min(100, score + 5);
    matches.push(`${cv.educacion.length} formaciones academicas`);
  }

  return {
    score: Math.round(score),
    peso,
    ponderado: Math.round(score * peso),
    detalle: nivelCandidato >= nivelReq
      ? 'Cumple con nivel educativo requerido'
      : 'Nivel educativo por debajo del requerimiento',
    matches,
    gaps,
  };
}

function scoreIdiomas(cv: CVParsedData, requeridos: string[], peso: number): DimensionScore {
  const matches: string[] = [];
  const gaps: string[] = [];

  if (requeridos.length === 0) {
    const bonus = cv.idiomas.length > 1 ? 15 : 0;
    const s = 70 + bonus;
    return { score: s, peso, ponderado: Math.round(s * peso), detalle: 'Sin requisito de idiomas', matches: cv.idiomas.map(i => `${i.idioma} (${i.nivel})`), gaps: [] };
  }

  const candidatoIdiomas = cv.idiomas.map(i => i.idioma.toLowerCase());

  let matchCount = 0;
  for (const req of requeridos) {
    if (candidatoIdiomas.some(i => i.includes(req.toLowerCase()) || req.toLowerCase().includes(i))) {
      matchCount++;
      const found = cv.idiomas.find(i => i.idioma.toLowerCase().includes(req.toLowerCase()));
      matches.push(`${req} (${found?.nivel || 'nivel no especificado'})`);
    } else {
      gaps.push(req);
    }
  }

  const score = Math.round((matchCount / requeridos.length) * 100);

  return { score, peso, ponderado: Math.round(score * peso), detalle: `${matchCount}/${requeridos.length} idiomas requeridos`, matches, gaps };
}

function scoreCertificaciones(cv: CVParsedData, requeridas: string[], peso: number): DimensionScore {
  const matches: string[] = [];
  const gaps: string[] = [];

  if (requeridas.length === 0) {
    const bonus = cv.certificaciones.length * 10;
    const score = Math.min(100, 60 + bonus);
    return { score, peso, ponderado: Math.round(score * peso), detalle: `${cv.certificaciones.length} certificacion(es) encontrada(s)`, matches: cv.certificaciones.map(c => c.nombre), gaps: [] };
  }

  const candidatoCerts = cv.certificaciones.map(c => c.nombre.toLowerCase());

  let matchCount = 0;
  for (const req of requeridas) {
    if (candidatoCerts.some(c => c.includes(req.toLowerCase()) || req.toLowerCase().includes(c))) {
      matchCount++;
      matches.push(req);
    } else {
      gaps.push(req);
    }
  }

  const score = Math.round((matchCount / requeridas.length) * 100);

  return { score, peso, ponderado: Math.round(score * peso), detalle: `${matchCount}/${requeridas.length} certificaciones requeridas`, matches, gaps };
}

function scoreKeywords(cv: CVParsedData, keywordsRequeridos: string[], peso: number): DimensionScore {
  const matches: string[] = [];
  const gaps: string[] = [];

  if (keywordsRequeridos.length === 0) {
    return { score: 70, peso, ponderado: Math.round(70 * peso), detalle: 'Sin keywords especificos', matches: [], gaps: [] };
  }

  const cvFullText = [
    ...cv.keywords,
    ...cv.habilidades_tecnicas,
    ...cv.habilidades_blandas,
    ...cv.experiencia.map(e => `${e.cargo} ${e.descripcion}`),
    ...cv.educacion.map(e => `${e.titulo} ${e.campo_estudio}`),
    cv.resumen_profesional,
  ].join(' ').toLowerCase();

  let matchCount = 0;
  for (const kw of keywordsRequeridos) {
    if (cvFullText.includes(kw.toLowerCase())) {
      matchCount++;
      matches.push(kw);
    } else {
      gaps.push(kw);
    }
  }

  const score = Math.round((matchCount / keywordsRequeridos.length) * 100);

  return { score, peso, ponderado: Math.round(score * peso), detalle: `${matchCount}/${keywordsRequeridos.length} keywords encontrados`, matches, gaps };
}

// --- UTILIDADES ---

function normalizeSkillName(skill: string): string {
  const aliases: Record<string, string> = {
    'js': 'javascript', 'ts': 'typescript', 'py': 'python',
    'react.js': 'react', 'reactjs': 'react',
    'node.js': 'nodejs', 'node': 'nodejs',
    'next.js': 'nextjs', 'next': 'nextjs',
    'vue.js': 'vue', 'vuejs': 'vue',
    'postgres': 'postgresql', 'pg': 'postgresql',
    'mongo': 'mongodb',
    'k8s': 'kubernetes',
    'aws': 'amazon web services',
    'gcp': 'google cloud platform',
    'tf': 'terraform',
  };
  return aliases[skill] || skill;
}

function extractSkillNames(habilidades: any): string[] {
  if (!Array.isArray(habilidades)) return [];
  return habilidades.map((s: string | { name: string }) =>
    typeof s === 'string' ? s : s.name
  );
}

function extractIdiomasFromCriterios(criterios: any): string[] {
  if (!criterios) return [];
  // Support both array format and flat object format
  if (Array.isArray(criterios)) {
    return [];
  }
  if (criterios.idiomas_requeridos && Array.isArray(criterios.idiomas_requeridos)) {
    return criterios.idiomas_requeridos;
  }
  return [];
}

function extractCertificacionesFromCriterios(criterios: any): string[] {
  if (!criterios) return [];
  if (Array.isArray(criterios)) {
    return [];
  }
  if (criterios.certificaciones_requeridas && Array.isArray(criterios.certificaciones_requeridas)) {
    return criterios.certificaciones_requeridas;
  }
  return [];
}

function extractKeywordsFromVacante(vacante: Vacante): string[] {
  const criterios = vacante.criterios_evaluacion as any;
  if (criterios?.keywords_requeridos && Array.isArray(criterios.keywords_requeridos)) {
    return criterios.keywords_requeridos;
  }
  return [];
}

function generarResumen(breakdown: ScoreBreakdown, total: number, minimo: number, pasa: boolean): string {
  const fuerte = Object.entries(breakdown)
    .filter(([, v]) => v.score >= 70)
    .map(([k]) => k)
    .join(', ');

  const debil = Object.entries(breakdown)
    .filter(([, v]) => v.score < 50)
    .map(([k]) => k)
    .join(', ');

  let resumen = `Score total: ${total}/100.`;
  if (fuerte) resumen += ` Fortalezas: ${fuerte}.`;
  if (debil) resumen += ` Areas debiles: ${debil}.`;
  resumen += pasa ? ` Pasa el corte (>=${minimo}).` : ` No pasa el corte (<${minimo}).`;

  return resumen;
}

// --- LEGACY FUNCTIONS (backward compat with existing routes) ---

interface LegacyScoreBreakdown {
  criterio: string;
  peso: number;
  score: number;
  ponderado: number;
  detalles: string;
}

interface LegacyAtsScoreResult {
  score_total: number;
  breakdown: LegacyScoreBreakdown[];
}

export async function calculateAtsScore(
  orgId: UUID,
  aplicacionId: UUID
): Promise<LegacyAtsScoreResult> {
  const appResult = await pool.query(
    `SELECT a.*, v.criterios_evaluacion, v.habilidades_requeridas, v.experiencia_minima,
      v.nivel_estudios, v.score_minimo,
      c.habilidades as candidato_habilidades, c.experiencia_anos, c.cv_parsed
    FROM aplicaciones a
    JOIN vacantes v ON a.vacante_id = v.id
    JOIN candidatos c ON a.candidato_id = c.id
    WHERE a.id = $1 AND v.organization_id = $2`,
    [aplicacionId, orgId]
  );

  if (appResult.rows.length === 0) throw new NotFoundError('Aplicacion', aplicacionId);

  const app = appResult.rows[0];
  const cvParsed = app.cv_parsed;

  // If we have full CVParsedData, use new engine
  if (cvParsed?.habilidades_tecnicas) {
    const vacante = {
      criterios_evaluacion: app.criterios_evaluacion,
      habilidades_requeridas: app.habilidades_requeridas,
      experiencia_minima: app.experiencia_minima,
      nivel_estudios: app.nivel_estudios,
      score_minimo: app.score_minimo,
    } as Vacante;

    const result = calculateATSScore(cvParsed, vacante);

    // Convert to legacy format
    return {
      score_total: result.score_total,
      breakdown: Object.entries(result.breakdown).map(([key, dim]) => ({
        criterio: key,
        peso: Math.round(dim.peso * 100),
        score: dim.score,
        ponderado: dim.ponderado,
        detalles: dim.detalle,
      })),
    };
  }

  // Fallback: old-style scoring for candidatos without parsed CV
  const criterios = app.criterios_evaluacion || [];
  const habilidadesRequeridas: string[] = app.habilidades_requeridas || [];
  const candidatoHabilidades: string[] = app.candidato_habilidades || [];
  const candidatoExp: number = app.experiencia_anos || 0;
  const expMinima: number = app.experiencia_minima || 0;

  if (!Array.isArray(criterios)) {
    // Flat object format: use new engine defaults
    return { score_total: 50, breakdown: [] };
  }

  const breakdown: LegacyScoreBreakdown[] = criterios.map((criterio: any) => {
    let score = 0;
    let detalles = '';

    const nombreLower = criterio.nombre?.toLowerCase() || '';

    if (nombreLower.includes('experiencia')) {
      if (candidatoExp >= expMinima) {
        score = Math.min(100, (candidatoExp / Math.max(expMinima, 1)) * 80 + 20);
        detalles = `${candidatoExp} anos (requerido: ${expMinima})`;
      } else {
        score = (candidatoExp / Math.max(expMinima, 1)) * 60;
        detalles = `${candidatoExp} anos (requerido: ${expMinima}) - Insuficiente`;
      }
    } else if (nombreLower.includes('habilidad') || nombreLower.includes('tecnic')) {
      const matching = candidatoHabilidades.filter((h: string) =>
        habilidadesRequeridas.some((r: string) => r.toLowerCase() === h.toLowerCase())
      );
      score = habilidadesRequeridas.length > 0
        ? (matching.length / habilidadesRequeridas.length) * 100
        : 50;
      detalles = `${matching.length}/${habilidadesRequeridas.length} habilidades coinciden`;
    } else if (nombreLower.includes('educacion')) {
      score = cvParsed?.educacion?.length > 0 ? 75 : 40;
      detalles = cvParsed?.educacion?.length > 0 ? 'Educacion verificada' : 'Sin datos de educacion';
    } else {
      score = 60;
      detalles = 'Evaluacion pendiente de revision manual';
    }

    score = Math.round(Math.max(0, Math.min(100, score)));
    const ponderado = (score * criterio.peso) / 100;

    return { criterio: criterio.nombre, peso: criterio.peso, score, ponderado, detalles };
  });

  const score_total = Math.round(breakdown.reduce((sum, b) => sum + b.ponderado, 0));

  return { score_total, breakdown };
}

export async function updateAplicacionScore(
  orgId: UUID,
  aplicacionId: UUID,
  scoreAts: number
): Promise<void> {
  await pool.query(
    `UPDATE aplicaciones SET score_ats = $3, updated_at = NOW()
    FROM vacantes v
    WHERE aplicaciones.id = $1 AND aplicaciones.vacante_id = v.id AND v.organization_id = $2`,
    [aplicacionId, orgId, scoreAts]
  );

  // Recalculate score_final with all available components
  try {
    const { recalcularScoreFinal } = await import('./scoring-dual.service');
    await recalcularScoreFinal(aplicacionId);
  } catch (err) {
    console.error('[Scoring ATS] Error recalculando score_final:', err);
  }
}

export async function batchScoreVacante(orgId: UUID, vacanteId: UUID): Promise<number> {
  const aplicaciones = await pool.query(
    `SELECT a.id FROM aplicaciones a JOIN vacantes v ON a.vacante_id = v.id
    WHERE a.vacante_id = $1 AND v.organization_id = $2 AND a.score_ats IS NULL`,
    [vacanteId, orgId]
  );

  let scored = 0;
  for (const app of aplicaciones.rows) {
    const result = await calculateAtsScore(orgId, app.id);
    await updateAplicacionScore(orgId, app.id, result.score_total);
    scored++;
  }

  return scored;
}
