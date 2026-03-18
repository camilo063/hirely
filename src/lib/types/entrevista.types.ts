import { UUID, EstadoEntrevistaIA, EstadoEntrevistaHumana } from './common.types';

// ─── ENTREVISTA IA (DAPTA) ─────────────────────────

export interface EntrevistaIA {
  id: UUID;
  aplicacion_id: UUID;
  dapta_call_id: string | null;
  estado: EntrevistaIAEstado;
  transcripcion: string | null;
  analisis: EntrevistaIAAnalisis | null;
  score_total: number | null;
  duracion_segundos: number | null;
  fecha_llamada: string | null;
  recording_url: string | null;
  preguntas_usadas: string[] | null;
  created_at: string;
  // Legacy columns from migration 004 (may coexist)
  organization_id?: UUID;
  candidato_id?: UUID;
  vacante_id?: UUID;
  // Joins opcionales
  candidato?: { id: string; nombre: string; email: string; telefono: string };
  vacante?: { id: string; titulo: string };
}

export type EntrevistaIAEstado = 'pendiente' | 'iniciando' | 'en_curso' | 'completada' | 'fallida' | 'cancelada';

// Análisis por 5 dimensiones (generado por Claude al analizar la transcripción)
export interface EntrevistaIAAnalisis {
  competencia_tecnica: DimensionAnalisis;
  motivacion: DimensionAnalisis;
  conexion_cultural: DimensionAnalisis;
  comunicacion: DimensionAnalisis;
  tono_emocional: DimensionAnalisis;
  resumen_general: string;
  fortalezas: string[];
  areas_mejora: string[];
  recomendacion: 'avanzar' | 'considerar' | 'no_avanzar';
  red_flags: string[];
  analyzed_at: string;
}

export interface DimensionAnalisis {
  score: number;       // 0-100
  peso: number;        // 0-1
  ponderado: number;   // score × peso
  justificacion: string;
  evidencia: string[];
}

// Pesos fijos de las dimensiones de entrevista IA
export const PESOS_ENTREVISTA_IA = {
  competencia_tecnica: 0.35,
  motivacion: 0.20,
  conexion_cultural: 0.20,
  comunicacion: 0.15,
  tono_emocional: 0.10,
} as const;

// Datos que Hirely envía a Dapta para iniciar la llamada
export interface DaptaCallRequest {
  candidato_telefono: string;
  candidato_nombre: string;
  vacante_titulo: string;
  empresa_nombre: string;
  preguntas: string[];
  idioma: string;
  max_duracion_minutos: number;
  contexto_adicional?: string;
}

// Datos que Dapta envía a Hirely via webhook
export interface DaptaWebhookPayload {
  call_id: string;
  status: 'completed' | 'failed' | 'no_answer' | 'busy' | 'voicemail';
  transcript: string;
  duration_seconds: number;
  from_number: string;
  to_number: string;
  started_at: string;
  ended_at: string;
  recording_url?: string;
  extracted_variables?: Record<string, string>;
  agent_id?: string;
  campaign_id?: string;
}

// ─── ENTREVISTA HUMANA ─────────────────────────────

export interface EntrevistaHumana {
  id: UUID;
  aplicacion_id: UUID;
  entrevistador_id: UUID;
  fecha_programada: string | null;
  fecha_realizada: string | null;
  estado: EntrevistaHumanaEstado;
  evaluacion: EvaluacionHumana | null;
  score_total: number | null;
  observaciones: string | null;
  calendar_event_id: string | null;
  email_invitacion_enviado: boolean;
  agendamiento_url: string | null;
  created_at: string;
  // Legacy columns
  organization_id?: UUID;
  candidato_id?: UUID;
  vacante_id?: UUID;
  // Joins
  entrevistador?: { id: string; nombre: string; email: string };
  candidato?: { id: string; nombre: string; email: string };
  vacante?: { id: string; titulo: string };
}

export type EntrevistaHumanaEstado = 'pendiente' | 'agendada' | 'realizada' | 'cancelada';

// Evaluación del entrevistador humano (5 criterios, escala 1-10)
export interface EvaluacionHumana {
  competencia_tecnica: CriterioHumano;
  habilidades_blandas: CriterioHumano;
  fit_cultural: CriterioHumano;
  potencial_crecimiento: CriterioHumano;
  presentacion_personal: CriterioHumano;
  observaciones_generales: string;
  recomendacion: 'contratar' | 'considerar' | 'no_contratar';
  evaluated_at: string;
}

export interface CriterioHumano {
  score: number;       // 1-10
  observacion: string;
}

// ─── SCORING DUAL ──────────────────────────────────

export interface ScoreDualResult {
  score_ia: number;
  score_humano: number;
  peso_ia: number;
  peso_humano: number;
  score_final: number;
  discrepancia: number;
  alerta_discrepancia: boolean;
  resumen: string;
}

// ─── CONFIGURACIÓN DE PREGUNTAS POR VACANTE ────────

export interface PreguntasEntrevistaConfig {
  tecnicas: string[];
  motivacionales: string[];
  culturales: string[];
  situacionales: string[];
}

export const PREGUNTAS_DEFAULT: PreguntasEntrevistaConfig = {
  tecnicas: [
    "Cuéntame sobre tu experiencia más relevante para este cargo.",
    "¿Cuáles son las herramientas y tecnologías que más dominas?",
    "Describe un proyecto técnico complejo que hayas liderado o en el que hayas contribuido significativamente.",
  ],
  motivacionales: [
    "¿Por qué te interesa esta posición?",
    "¿Qué es lo que más valoras en un ambiente de trabajo?",
    "¿Dónde te ves profesionalmente en 3 años?",
  ],
  culturales: [
    "¿Cómo describes tu estilo de trabajo en equipo?",
    "Cuéntame de una vez que tuviste un desacuerdo con un compañero de trabajo. ¿Cómo lo manejaste?",
  ],
  situacionales: [
    "Si tuvieras que aprender una tecnología completamente nueva en 2 semanas, ¿cómo lo abordarías?",
    "¿Cómo manejas la presión cuando tienes múltiples deadlines?",
  ],
};

// ─── BACKWARD COMPAT (used by existing services) ───

export interface EntrevistaIAConDetalles extends EntrevistaIA {
  candidato_nombre: string;
  candidato_apellido: string;
  vacante_titulo: string;
}

export interface EntrevistaHumanaConDetalles extends EntrevistaHumana {
  candidato_nombre: string;
  candidato_apellido: string;
  candidato_email?: string;
  vacante_titulo: string;
  entrevistador_nombre: string;
}

export interface CreateEntrevistaIAInput {
  aplicacion_id: UUID;
  candidato_id: UUID;
  vacante_id: UUID;
}

export interface CreateEntrevistaHumanaInput {
  aplicacion_id: UUID;
  candidato_id: UUID;
  vacante_id: UUID;
  entrevistador_id: UUID;
  fecha_programada: string;
  notas?: string;
  crear_evento_calendar?: boolean;
}
