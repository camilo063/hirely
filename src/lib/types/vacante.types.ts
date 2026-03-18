import { UUID, EstadoVacante } from './common.types';

export interface CriterioEvaluacion {
  nombre: string;
  peso: number;
  descripcion?: string;
}

export interface Vacante {
  id: UUID;
  organization_id: UUID;
  titulo: string;
  descripcion: string;
  departamento: string | null;
  ubicacion: string;
  tipo_contrato: string;
  rango_salarial_min: number | null;
  rango_salarial_max: number | null;
  moneda: string;
  modalidad: string;
  estado: EstadoVacante;
  criterios_evaluacion: CriterioEvaluacion[] | Record<string, number>;
  habilidades_requeridas: string[];
  experiencia_minima: number;
  nivel_estudios: string | null;
  score_minimo: number;
  linkedin_job_id: string | null;
  slug: string | null;
  is_published: boolean;
  published_at: Date | null;
  views_count: number;
  applications_count: number;
  created_by: UUID;
  created_at: Date;
  updated_at: Date;
}

export interface VacanteWithStats extends Vacante {
  total_aplicaciones: number;
  nuevos: number;
  en_proceso: number;
  seleccionados: number;
}

export interface CreateVacanteInput {
  titulo: string;
  descripcion: string;
  departamento?: string;
  ubicacion: string;
  tipo_contrato: string;
  modalidad?: string;
  rango_salarial_min?: number | null;
  rango_salarial_max?: number | null;
  moneda?: string;
  criterios_evaluacion?: CriterioEvaluacion[] | Record<string, number>;
  habilidades_requeridas: string[];
  experiencia_minima: number;
  score_minimo?: number;
}

export interface UpdateVacanteInput {
  titulo?: string;
  descripcion?: string;
  departamento?: string;
  ubicacion?: string;
  tipo_contrato?: string;
  modalidad?: string;
  rango_salarial_min?: number | null;
  rango_salarial_max?: number | null;
  moneda?: string;
  estado?: EstadoVacante | string;
  criterios_evaluacion?: CriterioEvaluacion[] | Record<string, number>;
  habilidades_requeridas?: string[];
  experiencia_minima?: number;
  score_minimo?: number;
}

export interface VacanteFilters {
  estado?: EstadoVacante | string;
  departamento?: string;
  search?: string;
}
