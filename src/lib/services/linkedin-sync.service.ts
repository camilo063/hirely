import { pool } from '@/lib/db';
import { createUnipileClient } from '@/lib/integrations/unipile.client';
import type { UnipileApplicant, UnipileExperience, UnipileEducation } from '@/lib/types/unipile.types';

/**
 * Syncs LinkedIn applicants from Unipile into Hirely's pipeline.
 *
 * Can be triggered by:
 * - Manual button in the UI ("Traer candidatos de LinkedIn")
 * - Unipile webhook
 * - Cron job
 */

export interface SyncResult {
  nuevos: number;
  actualizados: number;
  errores: number;
  detalles: string[];
}

export async function syncLinkedInApplicants(
  vacanteId: string,
  orgId: string,
  unipileJobId: string
): Promise<SyncResult> {
  const client = createUnipileClient();
  if (!client) {
    throw new Error('Unipile no esta configurado');
  }

  const result: SyncResult = { nuevos: 0, actualizados: 0, errores: 0, detalles: [] };

  // Fetch all applicants with pagination
  let cursor: string | undefined;
  const allApplicants: UnipileApplicant[] = [];

  do {
    const page = await client.listApplicants(unipileJobId, cursor);
    allApplicants.push(...page.items);
    cursor = page.cursor;
  } while (cursor);

  // Process each applicant
  for (const applicant of allApplicants) {
    try {
      let fullApplicant = applicant;
      if (applicant.id) {
        try {
          fullApplicant = await client.getApplicant(applicant.id);
        } catch {
          // Use basic data if detail fetch fails
        }
      }

      const synced = await upsertCandidatoFromLinkedIn(fullApplicant, vacanteId, orgId);
      if (synced.isNew) {
        result.nuevos++;
      } else {
        result.actualizados++;
      }
    } catch (error) {
      result.errores++;
      result.detalles.push(
        `Error con ${applicant.name}: ${error instanceof Error ? error.message : 'desconocido'}`
      );
    }
  }

  // Update sync timestamp on vacante
  await pool.query(
    `UPDATE vacantes
     SET linkedin_last_sync = NOW(),
         linkedin_applicants_count = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [allApplicants.length, vacanteId]
  );

  return result;
}

async function upsertCandidatoFromLinkedIn(
  applicant: UnipileApplicant,
  vacanteId: string,
  orgId: string
): Promise<{ isNew: boolean; candidatoId: string }> {
  // Map Unipile fields to CVParsedData structure (Spanish field names matching UI)
  const experienciaMapped = (applicant.experience || []).map((exp: UnipileExperience) => ({
    cargo: exp.title || '',
    empresa: exp.company || '',
    ubicacion: exp.location || '',
    fecha_inicio: exp.start_date || '',
    fecha_fin: exp.end_date || null,
    descripcion: exp.description || '',
    tecnologias: [] as string[],
  }));

  const educacionMapped = (applicant.education || []).map((edu: UnipileEducation) => ({
    titulo: edu.degree || '',
    institucion: edu.school || '',
    nivel: '',
    campo_estudio: edu.field_of_study || '',
    fecha_inicio: edu.start_date || '',
    fecha_fin: edu.end_date || '',
    en_curso: !edu.end_date,
  }));

  const cvParsed = {
    fuente: 'linkedin' as const,
    linkedin_provider_id: applicant.provider_id,
    resumen_profesional: applicant.headline || '',
    experiencia: experienciaMapped,
    educacion: educacionMapped,
    habilidades_tecnicas: applicant.skills || [],
    habilidades_blandas: [] as string[],
    idiomas: [] as Array<{ idioma: string; nivel: string }>,
    certificaciones: [] as Array<{ nombre: string; emisor: string; vigente: boolean }>,
    keywords: applicant.skills || [],
    parsed_at: new Date().toISOString(),
    sincronizado_at: new Date().toISOString(),
    parser_version: 'linkedin-sync-1.0',
    confianza: 0.7,
  };

  const experienciaAnos = calcularAnosExperiencia(applicant.experience || []);
  const nivelEducativo = extraerNivelEducativo(applicant.education || []);

  // Split name into nombre/apellido
  const nameParts = (applicant.name || '').split(' ');
  const nombre = nameParts[0] || 'Sin nombre';
  const apellido = nameParts.slice(1).join(' ') || '';

  let candidatoId: string;
  let isNew = false;

  if (applicant.email) {
    const existing = await pool.query(
      `SELECT id FROM candidatos WHERE organization_id = $1 AND email = $2`,
      [orgId, applicant.email]
    );

    if (existing.rows.length > 0) {
      candidatoId = existing.rows[0].id;
      await pool.query(
        `UPDATE candidatos SET
           nombre = COALESCE($1, nombre),
           apellido = COALESCE($2, apellido),
           telefono = COALESCE($3, telefono),
           linkedin_url = COALESCE($4, linkedin_url),
           cv_url = COALESCE($5, cv_url),
           cv_parsed = COALESCE(cv_parsed, '{}'::jsonb) || $6::jsonb,
           habilidades = CASE WHEN $7::text != '[]' THEN $7::jsonb ELSE habilidades END,
           experiencia_anos = COALESCE($8, experiencia_anos),
           nivel_educativo = COALESCE($9, nivel_educativo),
           ubicacion = COALESCE($10, ubicacion),
           updated_at = NOW()
         WHERE id = $11`,
        [
          nombre,
          apellido,
          applicant.phone || null,
          applicant.profile_url || null,
          applicant.resume_url || null,
          JSON.stringify(cvParsed),
          JSON.stringify(applicant.skills || []),
          experienciaAnos,
          nivelEducativo,
          applicant.location || null,
          candidatoId,
        ]
      );
    } else {
      const insert = await pool.query(
        `INSERT INTO candidatos (
           organization_id, nombre, apellido, email, telefono, linkedin_url,
           cv_url, cv_parsed, habilidades, experiencia_anos,
           nivel_educativo, ubicacion, fuente, tags
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'linkedin', '["linkedin-sync"]'::jsonb)
         RETURNING id`,
        [
          orgId, nombre, apellido,
          applicant.email,
          applicant.phone || null,
          applicant.profile_url || null,
          applicant.resume_url || null,
          JSON.stringify(cvParsed),
          JSON.stringify(applicant.skills || []),
          experienciaAnos,
          nivelEducativo,
          applicant.location || null,
        ]
      );
      candidatoId = insert.rows[0].id;
      isNew = true;
    }
  } else {
    // No email — look up by linkedin_url or create with placeholder
    const linkedinUrl = applicant.profile_url;
    const existing = linkedinUrl
      ? await pool.query(
          `SELECT id FROM candidatos WHERE organization_id = $1 AND linkedin_url = $2`,
          [orgId, linkedinUrl]
        )
      : { rows: [] };

    if (existing.rows.length > 0) {
      candidatoId = existing.rows[0].id;
    } else {
      const placeholderEmail = `linkedin_${applicant.provider_id || applicant.id}@pendiente.hirely.app`;
      const insert = await pool.query(
        `INSERT INTO candidatos (
           organization_id, nombre, apellido, email, telefono, linkedin_url,
           cv_url, cv_parsed, habilidades, experiencia_anos,
           nivel_educativo, ubicacion, fuente, tags
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'linkedin', '["linkedin-sync","email-pendiente"]'::jsonb)
         ON CONFLICT (organization_id, email) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [
          orgId, nombre, apellido,
          placeholderEmail,
          applicant.phone || null,
          applicant.profile_url || null,
          applicant.resume_url || null,
          JSON.stringify(cvParsed),
          JSON.stringify(applicant.skills || []),
          experienciaAnos,
          nivelEducativo,
          applicant.location || null,
        ]
      );
      candidatoId = insert.rows[0].id;
      isNew = true;
    }
  }

  // Create aplicacion if not exists
  await pool.query(
    `INSERT INTO aplicaciones (organization_id, vacante_id, candidato_id, estado, origen, notas)
     VALUES ($1, $2, $3, 'nuevo', 'linkedin', 'Aplico desde LinkedIn')
     ON CONFLICT (vacante_id, candidato_id) DO NOTHING`,
    [orgId, vacanteId, candidatoId]
  );

  // Auto-scoring para candidatos nuevos importados de LinkedIn
  if (isNew) {
    try {
      const { runScoringPipeline } = await import('./scoring-pipeline.service');
      await runScoringPipeline(candidatoId, vacanteId, orgId);
      console.log(`[LinkedIn Sync] Auto-scored candidato ${candidatoId}: OK`);
    } catch (error) {
      console.error(`[LinkedIn Sync] Error en auto-scoring candidato ${candidatoId}:`, error);
      // NO lanzar error — el sync no debe fallar si el scoring falla
    }
  }

  return { isNew, candidatoId };
}

function calcularAnosExperiencia(experience: UnipileExperience[]): number | null {
  if (!experience || experience.length === 0) return null;

  let totalMonths = 0;
  for (const exp of experience) {
    if (exp.start_date) {
      const start = new Date(exp.start_date);
      const end = exp.end_date ? new Date(exp.end_date) : new Date();
      const months = (end.getFullYear() - start.getFullYear()) * 12 +
                     (end.getMonth() - start.getMonth());
      totalMonths += Math.max(0, months);
    }
  }

  return Math.round(totalMonths / 12);
}

function extraerNivelEducativo(education: UnipileEducation[]): string | null {
  if (!education || education.length === 0) return null;

  const niveles: Record<string, number> = {
    'doctorado': 5, 'phd': 5, 'doctorate': 5,
    'maestria': 4, 'master': 4, 'mba': 4, 'magister': 4,
    'especializacion': 3, 'postgrado': 3, 'postgraduate': 3,
    'profesional': 2, 'bachelor': 2, 'licenciatura': 2, 'ingeniero': 2, 'ingenieria': 2,
    'tecnologo': 1, 'tecnico': 1, 'associate': 1,
  };

  let maxNivel = 0;
  let maxLabel: string | null = null;

  for (const edu of education) {
    const degree = (edu.degree || '').toLowerCase();
    for (const [keyword, level] of Object.entries(niveles)) {
      if (degree.includes(keyword) && level > maxNivel) {
        maxNivel = level;
        maxLabel = edu.degree || null;
      }
    }
  }

  return maxLabel;
}
