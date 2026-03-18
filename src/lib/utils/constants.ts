import { EstadoAplicacion, EstadoVacante, EstadoContrato } from '../types/common.types';

export const PIPELINE_STAGES: { id: EstadoAplicacion; label: string; color: string }[] = [
  { id: EstadoAplicacion.NUEVO, label: 'Nuevos', color: '#6B7280' },
  { id: EstadoAplicacion.REVISADO, label: 'Revisados', color: '#3B82F6' },
  { id: EstadoAplicacion.PRESELECCIONADO, label: 'Preseleccionados', color: '#8B5CF6' },
  { id: EstadoAplicacion.ENTREVISTA_IA, label: 'Entrevista IA', color: '#F59E0B' },
  { id: EstadoAplicacion.ENTREVISTA_HUMANA, label: 'Entrevista Humana', color: '#EC4899' },
  { id: EstadoAplicacion.EVALUADO, label: 'Evaluados', color: '#14B8A6' },
  { id: EstadoAplicacion.SELECCIONADO, label: 'Seleccionados', color: '#10B981' },
  { id: EstadoAplicacion.CONTRATADO, label: 'Contratados', color: '#059669' },
  { id: EstadoAplicacion.DESCARTADO, label: 'Descartados', color: '#EF4444' },
];

export const ESTADO_VACANTE_OPTIONS: { value: EstadoVacante; label: string }[] = [
  { value: EstadoVacante.BORRADOR, label: 'Borrador' },
  { value: EstadoVacante.PUBLICADA, label: 'Publicada' },
  { value: EstadoVacante.CERRADA, label: 'Cerrada' },
  { value: EstadoVacante.ARCHIVADA, label: 'Archivada' },
];

export const ESTADO_CONTRATO_OPTIONS: { value: EstadoContrato; label: string }[] = [
  { value: EstadoContrato.BORRADOR, label: 'Borrador' },
  { value: EstadoContrato.GENERADO, label: 'Generado' },
  { value: EstadoContrato.ENVIADO, label: 'Enviado' },
  { value: EstadoContrato.FIRMADO, label: 'Firmado' },
  { value: EstadoContrato.RECHAZADO, label: 'Rechazado' },
];

export const DEFAULT_CRITERIOS = [
  { nombre: 'Experiencia relevante', peso: 30, descripcion: 'Anos y calidad de experiencia en roles similares' },
  { nombre: 'Habilidades tecnicas', peso: 25, descripcion: 'Dominio de tecnologias y herramientas requeridas' },
  { nombre: 'Educacion', peso: 15, descripcion: 'Formacion academica y certificaciones' },
  { nombre: 'Habilidades blandas', peso: 15, descripcion: 'Comunicacion, liderazgo, trabajo en equipo' },
  { nombre: 'Cultura organizacional', peso: 15, descripcion: 'Alineacion con valores y cultura de la empresa' },
];

export const TIPOS_CONTRATO = [
  'Termino indefinido',
  'Termino fijo',
  'Prestacion de servicios',
  'Obra o labor',
  'Aprendizaje',
];

export const DEPARTAMENTOS = [
  'Tecnologia',
  'Producto',
  'Diseno',
  'Marketing',
  'Ventas',
  'Recursos Humanos',
  'Finanzas',
  'Operaciones',
  'Legal',
  'Soporte',
];

export const FUENTES_CANDIDATO = [
  'LinkedIn',
  'Referido',
  'Portal de empleo',
  'Sitio web',
  'Headhunting',
  'Feria laboral',
  'Otro',
];

export const MONEDAS = [
  { value: 'COP', label: 'Peso Colombiano (COP)' },
  { value: 'USD', label: 'Dolar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'MXN', label: 'Peso Mexicano (MXN)' },
];

export const MODALIDADES = [
  'presencial',
  'remoto',
  'hibrido',
];

export const JORNADAS = [
  'Tiempo completo',
  'Medio tiempo',
  'Por horas',
  'Flexible',
];

export const DEFAULT_PAGINATION = {
  page: 1,
  limit: 20,
};

export function getScoreColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  if (score >= 40) return '#F97316';
  return '#EF4444';
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excelente';
  if (score >= 60) return 'Bueno';
  if (score >= 40) return 'Regular';
  return 'Bajo';
}
