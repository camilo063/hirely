import { UUID, EstadoAplicacion } from './common.types';
import type { CVParsedData, ScoreBreakdown } from './scoring.types';

// Re-export for backward compatibility
export type CvParsedData = CVParsedData;

export interface ExperienciaLaboral {
  empresa: string;
  cargo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  descripcion: string;
}

export interface Educacion {
  institucion: string;
  titulo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
}

export interface Candidato {
  id: UUID;
  organization_id: UUID;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  linkedin_url: string | null;
  cv_url: string | null;
  cv_parsed: CVParsedData | null;
  habilidades: string[];
  experiencia_anos: number;
  salario_esperado: number | null;
  ubicacion: string | null;
  nivel_educativo: string | null;
  fuente: string;
  notas: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Aplicacion {
  id: UUID;
  organization_id: UUID;
  vacante_id: UUID;
  candidato_id: UUID;
  estado: EstadoAplicacion;
  score_ats: number | null;
  score_ats_breakdown: ScoreBreakdown | null;
  score_ats_resumen: string | null;
  scored_at: string | null;
  score_ia: number | null;
  score_humano: number | null;
  score_final: number | null;
  notas_internas: string | null;
  motivo_descarte: string | null;
  estados_completados: string[];
  created_at: Date;
  updated_at: Date;
}

export interface AplicacionConCandidato extends Aplicacion {
  candidato: Candidato;
}

export interface AplicacionConVacante extends Aplicacion {
  vacante_titulo: string;
  vacante_departamento: string;
  terminacion_motivo?: string | null;
  terminacion_detalle?: string | null;
  terminacion_fecha?: string | null;
  terminacion_notas?: string | null;
}

export interface CreateCandidatoInput {
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string | null;
  linkedin_url?: string | null;
  habilidades: string[];
  experiencia_anos: number;
  ubicacion?: string | null;
  nivel_educativo?: string | null;
  salario_esperado?: number | null;
  fuente?: string;
  notas?: string | null;
}

export interface CreateAplicacionInput {
  vacante_id: UUID;
  candidato_id: UUID;
  notas_internas?: string | null;
}

export interface CandidatoFilters {
  search?: string;
  habilidad?: string;
  fuente?: string;
  vacanteId?: string;
  estado?: string[];
  scoreRange?: string; // 'excelente' | 'bueno' | 'regular' | 'bajo' | 'sin_score'
}

export interface CandidatoVacanteInfo {
  id: string;
  titulo: string;
  estado: string;
  score_ats: number | null;
}

export interface CandidatoEnriquecido extends Candidato {
  vacantes: CandidatoVacanteInfo[] | null;
  max_score: number | null;
  estado_mas_avanzado: string | null;
}

export interface PipelineColumn {
  id: EstadoAplicacion;
  label: string;
  aplicaciones: AplicacionConCandidato[];
}
