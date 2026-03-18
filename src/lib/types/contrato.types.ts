import { UUID } from './common.types';

// ─── TIPOS BASE ──────────────────────────────

export type TipoContrato = 'prestacion_servicios' | 'horas_demanda' | 'laboral';
export type EstadoContrato = 'borrador' | 'generado' | 'enviado' | 'firmado' | 'rechazado';

// ─── PLANTILLA ────────────────────────────────

export interface PlantillaContrato {
  id: UUID;
  organization_id: UUID;
  nombre: string;
  tipo: TipoContrato | string;
  contenido_html: string;
  variables: VariableContrato[] | string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VariableContrato {
  key: string;
  label: string;
  tipo: 'auto' | 'manual';
  fuente?: string;
  default_value?: string;
  required: boolean;
}

// ─── CONTRATO ─────────────────────────────────

export interface Contrato {
  id: UUID;
  organization_id?: UUID;
  aplicacion_id: UUID;
  candidato_id?: UUID;
  vacante_id?: UUID;
  plantilla_id: UUID | null;
  tipo: TipoContrato | string;
  estado: EstadoContrato | string;
  datos_contrato: DatosContrato;
  contenido_html: string | null;
  pdf_url: string | null;
  docusign_envelope_id: string | null;
  firmado_at: string | null;
  version?: number;
  created_by?: UUID;
  created_at: string;
  updated_at: string;
}

export interface ContratoConDetalles extends Contrato {
  candidato_nombre: string;
  candidato_apellido: string;
  candidato_email: string;
  vacante_titulo: string;
}

export interface DatosContrato {
  // Auto-populated
  nombre_completo: string;
  cedula?: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  empresa_nombre?: string;
  empresa_nit?: string;
  empresa_representante?: string;
  empresa_direccion?: string;
  cargo: string;

  // Manual
  fecha_inicio: string;
  fecha_fin?: string;
  salario: string | number;
  salario_letras?: string;
  moneda?: string;
  jornada?: string;
  horario?: string;
  modalidad?: string;
  ubicacion_trabajo?: string;
  objeto_contrato?: string;
  obligaciones?: string;
  duracion?: string;
  periodo_prueba?: string;
  clausulas_adicionales?: string;
  fecha_contrato?: string;
  ciudad_contrato?: string;

  // Legacy compat
  documento_identidad?: string;
  departamento?: string;
  tipo_contrato?: string;
  beneficios?: string[];
  [key: string]: unknown;
}

// ─── VERSIONES ────────────────────────────────

export interface ContratoVersion {
  id: string;
  contrato_id: string;
  version: number;
  contenido_html: string;
  datos_contrato: DatosContrato;
  editado_por: string;
  editado_por_nombre?: string;
  nota_cambio?: string;
  created_at: string;
}

// ─── INPUT TYPES ──────────────────────────────

export interface CreateContratoInput {
  aplicacion_id: UUID;
  candidato_id?: UUID;
  vacante_id?: UUID;
  plantilla_id?: UUID | null;
  tipo?: TipoContrato | string;
  datos: DatosContrato;
}

export interface UpdateContratoInput {
  datos?: Partial<DatosContrato>;
  contenido_html?: string;
  html_content?: string;
  estado?: EstadoContrato | string;
  nota_cambio?: string;
}

// ─── VARIABLES POR TIPO ───────────────────────

export const VARIABLES_CONTRATO: Record<TipoContrato, VariableContrato[]> = {
  prestacion_servicios: [
    { key: 'nombre_completo', label: 'Nombre completo', tipo: 'auto', fuente: 'candidato.nombre', required: true },
    { key: 'cedula', label: 'Número de cédula', tipo: 'manual', required: true },
    { key: 'direccion', label: 'Dirección', tipo: 'manual', required: true },
    { key: 'telefono', label: 'Teléfono', tipo: 'auto', fuente: 'candidato.telefono', required: true },
    { key: 'correo', label: 'Correo electrónico', tipo: 'auto', fuente: 'candidato.email', required: true },
    { key: 'ciudad', label: 'Ciudad', tipo: 'auto', fuente: 'candidato.ubicacion', required: false },
    { key: 'empresa_nombre', label: 'Nombre de la empresa', tipo: 'auto', fuente: 'organization.name', required: true },
    { key: 'empresa_nit', label: 'NIT de la empresa', tipo: 'manual', required: true },
    { key: 'empresa_representante', label: 'Representante legal', tipo: 'manual', required: true },
    { key: 'cargo', label: 'Cargo / Objeto del servicio', tipo: 'auto', fuente: 'vacante.titulo', required: true },
    { key: 'objeto_contrato', label: 'Objeto del contrato', tipo: 'manual', required: true },
    { key: 'obligaciones', label: 'Obligaciones del contratista', tipo: 'manual', required: false },
    { key: 'fecha_inicio', label: 'Fecha de inicio', tipo: 'auto', fuente: 'aplicacion.fecha_inicio_tentativa', required: true },
    { key: 'fecha_fin', label: 'Fecha de finalización', tipo: 'manual', required: false },
    { key: 'duracion', label: 'Duración del contrato', tipo: 'manual', required: true, default_value: '6 meses' },
    { key: 'salario', label: 'Honorarios mensuales', tipo: 'auto', fuente: 'aplicacion.salario_ofrecido', required: true },
    { key: 'salario_letras', label: 'Honorarios en letras', tipo: 'manual', required: false },
    { key: 'fecha_contrato', label: 'Fecha del contrato', tipo: 'auto', fuente: 'today', required: true },
    { key: 'ciudad_contrato', label: 'Ciudad del contrato', tipo: 'manual', required: false, default_value: 'Bogotá D.C.' },
    { key: 'clausulas_adicionales', label: 'Cláusulas adicionales', tipo: 'manual', required: false },
  ],
  horas_demanda: [
    { key: 'nombre_completo', label: 'Nombre completo', tipo: 'auto', fuente: 'candidato.nombre', required: true },
    { key: 'cedula', label: 'Número de cédula', tipo: 'manual', required: true },
    { key: 'direccion', label: 'Dirección', tipo: 'manual', required: true },
    { key: 'telefono', label: 'Teléfono', tipo: 'auto', fuente: 'candidato.telefono', required: true },
    { key: 'correo', label: 'Correo electrónico', tipo: 'auto', fuente: 'candidato.email', required: true },
    { key: 'empresa_nombre', label: 'Nombre de la empresa', tipo: 'auto', fuente: 'organization.name', required: true },
    { key: 'empresa_nit', label: 'NIT de la empresa', tipo: 'manual', required: true },
    { key: 'empresa_representante', label: 'Representante legal', tipo: 'manual', required: true },
    { key: 'cargo', label: 'Cargo / Rol', tipo: 'auto', fuente: 'vacante.titulo', required: true },
    { key: 'objeto_contrato', label: 'Descripción del servicio', tipo: 'manual', required: true },
    { key: 'fecha_inicio', label: 'Fecha de inicio', tipo: 'auto', fuente: 'aplicacion.fecha_inicio_tentativa', required: true },
    { key: 'salario', label: 'Valor hora / tarifa', tipo: 'manual', required: true },
    { key: 'duracion', label: 'Duración estimada', tipo: 'manual', required: false },
    { key: 'modalidad', label: 'Modalidad', tipo: 'auto', fuente: 'vacante.modalidad', required: false },
    { key: 'fecha_contrato', label: 'Fecha del contrato', tipo: 'auto', fuente: 'today', required: true },
    { key: 'ciudad_contrato', label: 'Ciudad', tipo: 'manual', required: false, default_value: 'Bogotá D.C.' },
    { key: 'clausulas_adicionales', label: 'Cláusulas adicionales', tipo: 'manual', required: false },
  ],
  laboral: [
    { key: 'nombre_completo', label: 'Nombre completo', tipo: 'auto', fuente: 'candidato.nombre', required: true },
    { key: 'cedula', label: 'Número de cédula', tipo: 'manual', required: true },
    { key: 'direccion', label: 'Dirección de residencia', tipo: 'manual', required: true },
    { key: 'telefono', label: 'Teléfono', tipo: 'auto', fuente: 'candidato.telefono', required: true },
    { key: 'correo', label: 'Correo electrónico', tipo: 'auto', fuente: 'candidato.email', required: true },
    { key: 'ciudad', label: 'Ciudad', tipo: 'auto', fuente: 'candidato.ubicacion', required: false },
    { key: 'empresa_nombre', label: 'Razón social', tipo: 'auto', fuente: 'organization.name', required: true },
    { key: 'empresa_nit', label: 'NIT', tipo: 'manual', required: true },
    { key: 'empresa_representante', label: 'Representante legal', tipo: 'manual', required: true },
    { key: 'empresa_direccion', label: 'Dirección de la empresa', tipo: 'manual', required: false },
    { key: 'cargo', label: 'Cargo', tipo: 'auto', fuente: 'vacante.titulo', required: true },
    { key: 'fecha_inicio', label: 'Fecha de inicio', tipo: 'auto', fuente: 'aplicacion.fecha_inicio_tentativa', required: true },
    { key: 'fecha_fin', label: 'Fecha de terminación (si aplica)', tipo: 'manual', required: false },
    { key: 'salario', label: 'Salario mensual', tipo: 'auto', fuente: 'aplicacion.salario_ofrecido', required: true },
    { key: 'salario_letras', label: 'Salario en letras', tipo: 'manual', required: false },
    { key: 'jornada', label: 'Jornada laboral', tipo: 'manual', required: true, default_value: 'Tiempo completo' },
    { key: 'horario', label: 'Horario', tipo: 'manual', required: false, default_value: 'Lunes a viernes, 8:00 AM - 5:00 PM' },
    { key: 'modalidad', label: 'Modalidad de trabajo', tipo: 'auto', fuente: 'vacante.modalidad', required: true },
    { key: 'ubicacion_trabajo', label: 'Lugar de trabajo', tipo: 'auto', fuente: 'vacante.ubicacion', required: false },
    { key: 'periodo_prueba', label: 'Periodo de prueba', tipo: 'manual', required: false, default_value: '2 meses' },
    { key: 'duracion', label: 'Duración del contrato', tipo: 'manual', required: true, default_value: 'Indefinido' },
    { key: 'fecha_contrato', label: 'Fecha del contrato', tipo: 'auto', fuente: 'today', required: true },
    { key: 'ciudad_contrato', label: 'Ciudad del contrato', tipo: 'manual', required: false, default_value: 'Bogotá D.C.' },
    { key: 'clausulas_adicionales', label: 'Cláusulas adicionales', tipo: 'manual', required: false },
  ],
};

// ─── LABELS ───────────────────────────────────

export const TIPO_CONTRATO_LABELS: Record<TipoContrato, string> = {
  prestacion_servicios: 'Prestación de Servicios',
  horas_demanda: 'Horas y Demanda',
  laboral: 'Contrato Laboral',
};

export const ESTADO_CONTRATO_LABELS: Record<EstadoContrato, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: 'bg-gray-100 text-gray-600' },
  generado: { label: 'Generado', color: 'bg-blue-100 text-blue-600' },
  enviado: { label: 'Enviado para firma', color: 'bg-orange-100 text-orange-600' },
  firmado: { label: 'Firmado', color: 'bg-green-100 text-green-600' },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-600' },
};

// ─── LEGACY COMPAT ────────────────────────────

export interface DocumentoCandidato {
  id: UUID;
  organization_id: UUID;
  candidato_id: UUID;
  tipo: string;
  nombre: string;
  url: string;
  verificado: boolean;
  created_at: Date;
}
