/**
 * Tipos para el sistema de Evaluaciones Técnicas con Banco de Preguntas.
 */

export type TipoPregunta = 'opcion_multiple' | 'verdadero_falso' | 'respuesta_abierta' | 'codigo';
export type Dificultad = 'basico' | 'intermedio' | 'avanzado' | 'experto';
export type EstadoPregunta = 'activa' | 'borrador' | 'archivada';
export type EstadoEvaluacion = 'pendiente' | 'enviada' | 'en_progreso' | 'completada' | 'expirada' | 'cancelada';

export interface OpcionPregunta {
  id: string;         // "a", "b", "c", "d"
  texto: string;
  es_correcta: boolean;
}

export interface PreguntaBanco {
  id: string;
  organization_id: string;
  categoria: string;
  subcategoria: string | null;
  tipo: TipoPregunta;
  dificultad: Dificultad;
  enunciado: string;
  opciones: OpcionPregunta[] | null;
  respuesta_correcta: string | null;
  explicacion: string | null;
  puntos: number;
  tiempo_estimado_segundos: number;
  tags: string[];
  es_estandar: boolean;
  cargos_aplicables: string[];
  idioma: string;
  estado: EstadoPregunta;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface EstructuraPlantilla {
  categoria: string;
  cantidad: number;
  dificultad: Dificultad | 'mixta';
  puntos_por_pregunta: number;
}

export interface EvaluacionPlantilla {
  id: string;
  organization_id: string;
  nombre: string;
  descripcion: string | null;
  duracion_minutos: number;
  puntaje_total: number;
  puntaje_aprobatorio: number;
  aleatorizar_preguntas: boolean;
  mostrar_resultados_al_candidato: boolean;
  estructura: EstructuraPlantilla[];
  cargos_sugeridos: string[];
  tags: string[];
  estado: string;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreguntaAsignada {
  pregunta_id: string;
  enunciado: string;
  tipo: TipoPregunta;
  opciones: OpcionPregunta[] | null;  // Sin es_correcta para el candidato
  puntos: number;
  orden: number;
  categoria: string;
  dificultad: Dificultad;
}

/** Internal version with correct answers for scoring */
export interface PreguntaAsignadaConRespuesta extends PreguntaAsignada {
  respuesta_correcta: string | null;
  explicacion: string | null;
}

export interface RespuestaCandidato {
  pregunta_id: string;
  respuesta: string;
  tiempo_segundos: number;
  respondida_at: string;
}

export interface ScoreDetalle {
  [categoria: string]: {
    correctas: number;
    total: number;
    score: number;
    puntos_obtenidos: number;
    puntos_posibles: number;
  };
}

export interface Evaluacion {
  id: string;
  organization_id: string;
  aplicacion_id: string;
  candidato_id: string;
  vacante_id: string;
  plantilla_id: string | null;
  titulo: string;
  duracion_minutos: number;
  puntaje_total: number;
  puntaje_aprobatorio: number;
  preguntas: PreguntaAsignada[];
  estado: EstadoEvaluacion;
  respuestas: RespuestaCandidato[];
  score_total: number | null;
  score_detalle: ScoreDetalle | null;
  aprobada: boolean | null;
  token_acceso: string;
  token_expira_at: string | null;
  enviada_at: string | null;
  iniciada_at: string | null;
  completada_at: string | null;
  eventos_seguridad: Array<{ tipo: string; timestamp: string }>;
  asignado_por: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  candidato_nombre?: string;
  candidato_apellido?: string;
  candidato_email?: string;
  vacante_titulo?: string;
}

export interface PreguntaFiltros {
  organization_id: string;
  categoria?: string;
  dificultad?: Dificultad;
  tipo?: TipoPregunta;
  tags?: string[];
  cargo?: string;
  es_estandar?: boolean;
  estado?: EstadoPregunta;
  busqueda?: string;
  page?: number;
  limit?: number;
}

export interface CategoriaConteo {
  categoria: string;
  total: number;
  por_dificultad: Record<Dificultad, number>;
}
