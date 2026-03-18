/**
 * Types for Module 7: Selection, Documents & Candidate Portal.
 */

// ─── CHECKLIST DE DOCUMENTOS ──────────────────

export type TipoContrato = 'prestacion_servicios' | 'horas_demanda' | 'laboral';

export interface DocumentoChecklist {
  tipo: string;
  label: string;
  descripcion?: string;
  requerido: boolean;
  aplica_para?: TipoContrato[];
}

export const CHECKLIST_DOCUMENTOS_DEFAULT: DocumentoChecklist[] = [
  { tipo: 'cedula', label: 'Cedula de ciudadania', requerido: true, descripcion: 'Ambos lados, legible' },
  { tipo: 'hoja_vida', label: 'Hoja de vida actualizada', requerido: true },
  { tipo: 'certificados_estudio', label: 'Certificados de estudio', requerido: true, descripcion: 'Diploma o acta de grado del ultimo titulo obtenido' },
  { tipo: 'certificados_laborales', label: 'Certificados laborales', requerido: false, descripcion: 'De los ultimos 2 empleos' },
  { tipo: 'antecedentes_disciplinarios', label: 'Antecedentes disciplinarios', requerido: true, descripcion: 'Certificado de la Procuraduria General' },
  { tipo: 'antecedentes_judiciales', label: 'Antecedentes judiciales', requerido: true, descripcion: 'Certificado de la Policia Nacional' },
  { tipo: 'rut', label: 'RUT', requerido: false, aplica_para: ['prestacion_servicios'], descripcion: 'Registro Unico Tributario actualizado' },
  { tipo: 'certificacion_bancaria', label: 'Certificacion bancaria', requerido: true, descripcion: 'Con numero de cuenta para pagos' },
  { tipo: 'eps', label: 'Certificado EPS', requerido: false, aplica_para: ['laboral'], descripcion: 'Afiliacion a salud' },
  { tipo: 'pension', label: 'Certificado pension', requerido: false, aplica_para: ['laboral'] },
  { tipo: 'foto', label: 'Foto tipo documento', requerido: false, descripcion: 'Fondo blanco, reciente' },
  { tipo: 'otro', label: 'Otro documento', requerido: false },
];

// ─── DOCUMENTO SUBIDO POR CANDIDATO ───────────

export type EstadoDocumento = 'pendiente' | 'subido' | 'verificado' | 'rechazado';

export interface DocumentoCandidatoRow {
  id: string;
  aplicacion_id: string;
  tipo: string;
  nombre_archivo: string | null;
  url: string;
  estado: EstadoDocumento;
  nota_rechazo?: string | null;
  verificado_por?: string | null;
  verificado_at?: string | null;
  created_at: string;
}

export interface DocumentoConLabel extends DocumentoCandidatoRow {
  label: string;
  descripcion?: string;
  requerido: boolean;
}

// ─── TOKEN DE ACCESO AL PORTAL ────────────────

export interface PortalDocumentosToken {
  aplicacion_id: string;
  candidato_id: string;
  organization_id: string;
  expires_at: number;
}

// ─── SELECCIÓN ────────────────────────────────

export interface SeleccionPayload {
  aplicacion_id: string;
  enviar_email_seleccion: boolean;
  tipo_contrato?: TipoContrato;
  mensaje_personalizado?: string;
  fecha_inicio_tentativa?: string;
  salario_ofrecido?: number;
  moneda?: string;
}

export interface RechazoPayload {
  aplicacion_ids: string[];
  enviar_email_rechazo: boolean;
  mensaje_personalizado?: string;
}

// ─── PORTAL DATA ──────────────────────────────

export interface PortalData {
  candidato: { nombre: string };
  vacante: { titulo: string };
  empresa: { nombre: string };
  documentos: DocumentoConLabel[];
  progreso: {
    total: number;
    subidos: number;
    verificados: number;
    requeridos_faltantes: number;
  };
  completo: boolean;
  token_valid: boolean;
  expires_at: string;
}
