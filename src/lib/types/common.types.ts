// ============================================================
// Common Types & Enums
// ============================================================

export type UUID = string;

export enum EstadoVacante {
  BORRADOR = 'borrador',
  PUBLICADA = 'publicada',
  PAUSADA = 'pausada',
  CERRADA = 'cerrada',
  ARCHIVADA = 'archivada',
}

export enum EstadoAplicacion {
  NUEVO = 'nuevo',
  EN_REVISION = 'en_revision',
  REVISADO = 'revisado',
  PRESELECCIONADO = 'preseleccionado',
  ENTREVISTA_IA = 'entrevista_ia',
  ENTREVISTA_HUMANA = 'entrevista_humana',
  EVALUADO = 'evaluado',
  SELECCIONADO = 'seleccionado',
  DOCUMENTOS_PENDIENTES = 'documentos_pendientes',
  DOCUMENTOS_COMPLETOS = 'documentos_completos',
  CONTRATADO = 'contratado',
  CONTRATO_TERMINADO = 'contrato_terminado',
  DESCARTADO = 'descartado',
}

export enum EstadoContrato {
  BORRADOR = 'borrador',
  GENERADO = 'generado',
  ENVIADO = 'enviado',
  FIRMADO = 'firmado',
  RECHAZADO = 'rechazado',
}

export enum EstadoEntrevistaIA {
  PENDIENTE = 'pendiente',
  EN_PROGRESO = 'en_progreso',
  COMPLETADA = 'completada',
  CANCELADA = 'cancelada',
}

export enum EstadoEntrevistaHumana {
  AGENDADA = 'agendada',
  COMPLETADA = 'completada',
  CANCELADA = 'cancelada',
  NO_SHOW = 'no_show',
}

export enum RolUsuario {
  ADMIN = 'admin',
  RECLUTADOR = 'reclutador',
  HIRING_MANAGER = 'hiring_manager',
  VIEWER = 'viewer',
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Organization {
  id: UUID;
  nombre: string;
  slug: string;
  logo_url: string | null;
  configuracion: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: UUID;
  organization_id: UUID;
  email: string;
  nombre: string;
  apellido: string;
  password_hash: string;
  rol: RolUsuario;
  avatar_url: string | null;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ActivityLog {
  id: UUID;
  organization_id: UUID;
  user_id: UUID;
  entidad: string;
  entidad_id: UUID;
  accion: string;
  detalles: Record<string, unknown>;
  created_at: Date;
}

export interface OrgSettings {
  id: UUID;
  organization_id: UUID;
  peso_ia: number;
  peso_humano: number;
  umbral_preseleccion: number;
  dias_vencimiento_oferta: number;
  configuracion_email: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
