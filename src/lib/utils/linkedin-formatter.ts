import { Vacante } from '@/lib/types/vacante.types';
import { LinkedInPreviewContent, LinkedInWorkplaceType, LinkedInEmploymentType } from '@/lib/types/linkedin.types';

/**
 * Transforms a Hirely vacancy into LinkedIn-compatible format.
 * Shared between deep-link and API modes.
 */

const WORKPLACE_MAP: Record<string, LinkedInWorkplaceType> = {
  remoto: 'REMOTE',
  hibrido: 'HYBRID',
  presencial: 'ON_SITE',
};

const EMPLOYMENT_MAP: Record<string, LinkedInEmploymentType> = {
  laboral: 'FULL_TIME',
  prestacion_servicios: 'CONTRACT',
  horas_demanda: 'PART_TIME',
};

export function formatVacanteForLinkedIn(
  vacante: Vacante,
  applyBaseUrl: string
): LinkedInPreviewContent {
  // HTML for LinkedIn API
  const descriptionHtml = buildLinkedInDescription(vacante);

  // Plain text formatted for clipboard/textarea — NOT stripHtml
  const description = buildPlainTextDescription(vacante);

  const skills = Array.isArray(vacante.habilidades_requeridas)
    ? vacante.habilidades_requeridas.map((s: string | { name: string }) =>
        typeof s === 'string' ? s : s.name
      )
    : [];

  const salaryRange = vacante.rango_salarial_min && vacante.rango_salarial_max
    ? `${vacante.moneda || 'COP'} ${formatNumber(vacante.rango_salarial_min)} - ${formatNumber(vacante.rango_salarial_max)}`
    : undefined;

  return {
    title: vacante.titulo,
    description,
    descriptionHtml,
    location: vacante.ubicacion || 'Colombia',
    employmentType: EMPLOYMENT_MAP[vacante.tipo_contrato || ''] || 'FULL_TIME',
    workplaceType: WORKPLACE_MAP[vacante.modalidad || ''] || 'REMOTE',
    skills,
    salaryRange,
    applyUrl: `${applyBaseUrl}/empleo/${vacante.id}`,
  };
}

/**
 * Builds plain text description with readable formatting for clipboard/textarea.
 */
function buildPlainTextDescription(vacante: Vacante): string {
  const sections: string[] = [];

  if (vacante.descripcion) {
    const cleanDesc = vacante.descripcion
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li>/gi, '\u2022 ')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    sections.push(cleanDesc);
  }

  const skills = Array.isArray(vacante.habilidades_requeridas)
    ? vacante.habilidades_requeridas.map((s: string | { name: string }) =>
        typeof s === 'string' ? s : s.name
      )
    : [];

  if (skills.length > 0) {
    const skillsList = skills.map(s => `\u2022 ${s}`).join('\n');
    sections.push(`Habilidades Requeridas:\n${skillsList}`);
  }

  const requisitos: string[] = [];
  if (vacante.experiencia_minima && vacante.experiencia_minima > 0) {
    requisitos.push(`\u2022 Experiencia minima: ${vacante.experiencia_minima} ano(s)`);
  }
  if (vacante.nivel_estudios) {
    requisitos.push(`\u2022 Nivel de estudios: ${vacante.nivel_estudios}`);
  }
  if (requisitos.length > 0) {
    sections.push(`Requisitos:\n${requisitos.join('\n')}`);
  }

  const meta: string[] = [];
  if (vacante.modalidad) {
    const labels: Record<string, string> = {
      remoto: 'Remoto',
      hibrido: 'Hibrido',
      presencial: 'Presencial',
    };
    meta.push(labels[vacante.modalidad] || vacante.modalidad);
  }
  if (vacante.ubicacion) {
    meta.push(vacante.ubicacion);
  }
  if (vacante.rango_salarial_min && vacante.rango_salarial_max) {
    meta.push(`${vacante.moneda || 'COP'} ${formatNumber(vacante.rango_salarial_min)} - ${formatNumber(vacante.rango_salarial_max)}`);
  }
  if (meta.length > 0) {
    sections.push(meta.join(' | '));
  }

  return sections.join('\n\n');
}

/**
 * Builds HTML description for LinkedIn API.
 */
function buildLinkedInDescription(vacante: Vacante): string {
  const sections: string[] = [];

  if (vacante.descripcion) {
    sections.push(`<p>${vacante.descripcion}</p>`);
  }

  const skills = Array.isArray(vacante.habilidades_requeridas)
    ? vacante.habilidades_requeridas : [];
  if (skills.length > 0) {
    const skillItems = skills
      .map((s: string | { name: string }) => `<li>${typeof s === 'string' ? s : s.name}</li>`)
      .join('');
    sections.push(`<h3>Habilidades Requeridas</h3><ul>${skillItems}</ul>`);
  }

  const requisitos: string[] = [];
  if (vacante.experiencia_minima && vacante.experiencia_minima > 0) {
    requisitos.push(`<li>Experiencia minima: ${vacante.experiencia_minima} ano(s)</li>`);
  }
  if (vacante.nivel_estudios) {
    requisitos.push(`<li>Nivel de estudios: ${vacante.nivel_estudios}</li>`);
  }
  if (requisitos.length > 0) {
    sections.push(`<h3>Requisitos</h3><ul>${requisitos.join('')}</ul>`);
  }

  const info: string[] = [];
  if (vacante.modalidad) {
    const modalidadLabel: Record<string, string> = {
      remoto: 'Remoto',
      hibrido: 'Hibrido',
      presencial: 'Presencial',
    };
    info.push(modalidadLabel[vacante.modalidad] || vacante.modalidad);
  }
  if (vacante.ubicacion) {
    info.push(vacante.ubicacion);
  }
  if (vacante.rango_salarial_min && vacante.rango_salarial_max) {
    info.push(`${vacante.moneda || 'COP'} ${formatNumber(vacante.rango_salarial_min)} - ${formatNumber(vacante.rango_salarial_max)}`);
  }
  if (info.length > 0) {
    sections.push(`<p><br/><strong>${info.join(' | ')}</strong></p>`);
  }

  return sections.join('\n');
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-CO').format(num);
}
