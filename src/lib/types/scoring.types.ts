/**
 * Tipos para el motor de Scoring ATS.
 *
 * El scoring tiene 6 dimensiones con pesos configurables por vacante.
 * Cada dimension se evalua de 0 a 100, y el score final es la suma ponderada.
 */

// Datos estructurados extraidos del CV por Claude API
export interface CVParsedData {
  // Datos personales
  nombre: string;
  email: string | null;
  telefono: string | null;
  ubicacion: string | null;
  linkedin_url: string | null;

  // Experiencia laboral
  experiencia: ExperienciaLaboral[];
  experiencia_total_anos: number;

  // Educacion
  educacion: EducacionCV[];
  nivel_educativo_max: string; // doctorado | maestria | especializacion | profesional | tecnologo | bachiller

  // Skills
  habilidades_tecnicas: string[];
  habilidades_blandas: string[];

  // Idiomas
  idiomas: Idioma[];

  // Certificaciones
  certificaciones: Certificacion[];

  // Keywords detectados (todos los terminos relevantes del CV)
  keywords: string[];

  // Resumen generado por IA
  resumen_profesional: string;

  // Metadata del parsing
  parsed_at: string;
  parser_version: string;
  fuente: 'pdf' | 'linkedin' | 'manual';
  confianza: number; // 0-1
}

export interface ExperienciaLaboral {
  cargo: string;
  empresa: string;
  ubicacion?: string;
  fecha_inicio: string; // YYYY-MM
  fecha_fin: string | null; // null = actualmente
  duracion_meses: number;
  descripcion: string;
  tecnologias: string[];
  es_relevante?: boolean;
}

export interface EducacionCV {
  titulo: string;
  institucion: string;
  nivel: string; // doctorado | maestria | especializacion | profesional | tecnologo | bachiller
  campo_estudio: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  en_curso: boolean;
}

export interface Idioma {
  idioma: string;
  nivel: 'basico' | 'intermedio' | 'avanzado' | 'nativo';
}

export interface Certificacion {
  nombre: string;
  emisor: string;
  fecha?: string;
  vigente: boolean;
}

// Criterios de evaluacion configurados en la vacante
export interface CriteriosEvaluacion {
  experiencia: number; // Peso 0-1 (default 0.30)
  habilidades: number; // Peso 0-1 (default 0.25)
  educacion: number; // Peso 0-1 (default 0.15)
  idiomas: number; // Peso 0-1 (default 0.15)
  certificaciones: number; // Peso 0-1 (default 0.10)
  keywords: number; // Peso 0-1 (default 0.05)
}

// Resultado del scoring por dimension
export interface ScoreBreakdown {
  experiencia: DimensionScore;
  habilidades: DimensionScore;
  educacion: DimensionScore;
  idiomas: DimensionScore;
  certificaciones: DimensionScore;
  keywords: DimensionScore;
}

export interface DimensionScore {
  score: number; // 0-100 de esta dimension
  peso: number; // Peso configurado (0-1)
  ponderado: number; // score * peso
  detalle: string; // Explicacion legible del score
  matches: string[]; // Que elementos matchearon
  gaps: string[]; // Que falta vs. el requerimiento
}

// Resultado completo del scoring ATS
export interface ATSScoreResult {
  score_total: number; // 0-100 (suma de ponderados)
  breakdown: ScoreBreakdown;
  pasa_corte: boolean; // score_total >= score_minimo
  score_minimo: number; // Umbral configurado en la vacante
  resumen: string; // Resumen legible del analisis
  recomendacion: 'alta' | 'media' | 'baja' | 'no_apto';
  scored_at: string; // ISO date
}

// Criterios por defecto (usados si la vacante no tiene configuracion custom)
export const DEFAULT_CRITERIOS: CriteriosEvaluacion = {
  experiencia: 0.30,
  habilidades: 0.25,
  educacion: 0.15,
  idiomas: 0.15,
  certificaciones: 0.10,
  keywords: 0.05,
};
