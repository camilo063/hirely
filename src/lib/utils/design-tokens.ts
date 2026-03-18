/**
 * Design tokens centralizados de Hirely.
 * Usar en componentes para mantener consistencia visual.
 */

export const COLORS = {
  navy: '#0A1F3F',
  teal: '#00BCD4',
  tealDark: '#00ACC1',
  orange: '#FF6B35',
  green: '#10B981',
  lightBlue: '#F0F9FF',
  softGray: '#F5F7FA',
} as const;

export const ESTADO_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  nuevo: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Nuevo' },
  en_revision: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En Revision' },
  revisado: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Revisado' },
  preseleccionado: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Preseleccionado' },
  entrevista_ia: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Entrevista IA' },
  entrevista_humana: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Entrevista Humana' },
  seleccionado: { bg: 'bg-green-100', text: 'text-green-700', label: 'Seleccionado' },
  contratado: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Contratado' },
  descartado: { bg: 'bg-red-100', text: 'text-red-700', label: 'Descartado' },
  onboarding: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Onboarding' },
};

export const VACANTE_ESTADO_COLORS: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  borrador: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Borrador', dot: 'bg-gray-400' },
  publicada: { bg: 'bg-green-100', text: 'text-green-700', label: 'Publicada', dot: 'bg-green-500' },
  pausada: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pausada', dot: 'bg-amber-500' },
  cerrada: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cerrada', dot: 'bg-red-500' },
};

export const SCORE_COLORS = {
  alta: { bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-200', label: 'Alta' },
  buena: { bg: 'bg-teal-100', text: 'text-teal-700', ring: 'ring-teal-200', label: 'Buena' },
  media: { bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-200', label: 'Media' },
  baja: { bg: 'bg-red-100', text: 'text-red-700', ring: 'ring-red-200', label: 'Baja' },
};

export function getScoreColor(score: number | null | undefined) {
  if (score === null || score === undefined) return { bg: 'bg-gray-100', text: 'text-gray-400', ring: 'ring-gray-200', label: 'N/A' };
  if (score >= 85) return SCORE_COLORS.alta;
  if (score >= 70) return SCORE_COLORS.buena;
  if (score >= 50) return SCORE_COLORS.media;
  return SCORE_COLORS.baja;
}

export function getEstadoColor(estado: string) {
  return ESTADO_COLORS[estado] || { bg: 'bg-gray-100', text: 'text-gray-700', label: estado.replace(/_/g, ' ') };
}

export function getVacanteEstadoColor(estado: string) {
  return VACANTE_ESTADO_COLORS[estado] || { bg: 'bg-gray-100', text: 'text-gray-600', label: estado, dot: 'bg-gray-400' };
}

export const FUENTE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  portal: { bg: 'bg-teal-50', text: 'text-teal-700', label: 'Portal' },
  linkedin: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'LinkedIn' },
  referido: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Referido' },
  manual: { bg: 'bg-gray-50', text: 'text-gray-700', label: 'Manual' },
  banco_talento: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Banco talento' },
  test: { bg: 'bg-gray-50', text: 'text-gray-500', label: 'Test' },
};

export function getFuenteColor(fuente: string) {
  return FUENTE_COLORS[fuente] || { bg: 'bg-gray-50', text: 'text-gray-600', label: fuente };
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos dias';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}
