import { pool } from '@/lib/db';
import { Vacante } from '@/lib/types/vacante.types';
import { LinkedInPublishResult, LinkedInIntegrationMode } from '@/lib/types/linkedin.types';
import { formatVacanteForLinkedIn } from '@/lib/utils/linkedin-formatter';
import { executeDeepLinkPublish } from '@/lib/integrations/linkedin-deeplink';
import { createLinkedInJobClient } from '@/lib/integrations/linkedin.client';
import { createUnipileClient } from '@/lib/integrations/unipile.client';

/**
 * LinkedIn publishing service with Strategy Pattern.
 *
 * Priority: unipile > api > deeplink
 */

// Lazy getter to avoid throwing at module load if env var is missing
function getBaseUrl() {
  return process.env.NEXTAUTH_URL || process.env.APP_URL || '';
}

export function getLinkedInMode(): LinkedInIntegrationMode {
  const envMode = process.env.LINKEDIN_INTEGRATION_MODE;

  if (envMode === 'unipile') {
    const client = createUnipileClient();
    if (client?.isConfigured()) {
      return 'unipile';
    }
    console.warn('[LinkedIn] Mode "unipile" but not configured. Falling back to deeplink.');
  }

  if (envMode === 'api') {
    const client = createLinkedInJobClient();
    if (client?.isConfigured()) {
      return 'api';
    }
    console.warn('[LinkedIn] Mode "api" but credentials not configured. Falling back to deeplink.');
  }

  return 'deeplink';
}

export async function publishToLinkedIn(vacante: Vacante): Promise<LinkedInPublishResult> {
  const mode = getLinkedInMode();
  const content = formatVacanteForLinkedIn(vacante, getBaseUrl());

  if (mode === 'unipile') {
    return await publishViaUnipile(vacante, content);
  }

  if (mode === 'api') {
    return await publishViaApi(vacante, content);
  }

  return publishViaDeepLink(content);
}

async function publishViaUnipile(
  vacante: Vacante,
  content: ReturnType<typeof formatVacanteForLinkedIn>
): Promise<LinkedInPublishResult> {
  const client = createUnipileClient();
  if (!client) {
    return publishViaDeepLink(content);
  }

  try {
    // Get organization name for the company field
    const orgResult = await pool.query(
      'SELECT name FROM organizations WHERE id = $1',
      [vacante.organization_id]
    );
    const companyName = orgResult.rows[0]?.name || 'Empresa';

    const draft = await client.createJobDraft({
      title: content.title,
      description: content.description,
      descriptionHtml: content.descriptionHtml,
      location: content.location,
      workplace: content.workplaceType as 'ON_SITE' | 'HYBRID' | 'REMOTE',
      employment_type: content.employmentType as 'FULL_TIME',
      company_name: companyName,
      skills: content.skills,
      apply_url: content.applyUrl,
    });

    const draftJobId = draft.job_id || draft.id;
    if (!draftJobId) {
      throw new Error('Unipile createJobDraft did not return a job_id');
    }

    // Check free posting eligibility before publishing
    const freeOptions = draft.publish_options?.free;
    if (freeOptions && !freeOptions.eligible) {
      const reason = freeOptions.ineligible_reason || 'desconocido';
      const reasonMessages: Record<string, string> = {
        'REACH_ACTIVE_FREE_JOB_LIMIT': 'Has alcanzado el limite de vacantes gratuitas en LinkedIn. Cierra una vacante existente en LinkedIn antes de publicar otra.',
      };
      const userMessage = reasonMessages[reason] || `LinkedIn no permite publicacion gratuita: ${reason}`;
      console.warn(`[Unipile] Draft ${draftJobId} not eligible for free posting: ${reason}`);

      // Fall back to deeplink so the user can post manually
      const fallback = publishViaDeepLink(content);
      return {
        ...fallback,
        error: userMessage,
      };
    }

    const published = await client.publishJob(draftJobId, 'FREE');
    const linkedinJobId = published.job_id || published.provider_id || published.id || draftJobId;

    // Only store linkedin_job_id AFTER successful publish
    await pool.query(
      `UPDATE vacantes
       SET linkedin_job_id = $1,
           estado = CASE WHEN estado = 'borrador' THEN 'publicada' ELSE estado END,
           updated_at = NOW()
       WHERE id = $2`,
      [linkedinJobId, vacante.id]
    );

    return {
      success: true,
      mode: 'unipile',
      linkedinJobId,
    };
  } catch (error) {
    console.error('[Unipile] Publish failed, falling back to deeplink:', error);
    const fallback = publishViaDeepLink(content);
    return {
      ...fallback,
      error: `Unipile fallo: ${error instanceof Error ? error.message : 'desconocido'}. Se genero enlace alternativo.`,
    };
  }
}

async function publishViaApi(
  vacante: Vacante,
  content: ReturnType<typeof formatVacanteForLinkedIn>
): Promise<LinkedInPublishResult> {
  const client = createLinkedInJobClient();
  if (!client) {
    return publishViaDeepLink(content);
  }

  const result = await client.postJob({
    externalJobPostingId: vacante.id,
    title: content.title,
    description: content.descriptionHtml,
    location: content.location,
    companyApplyUrl: content.applyUrl,
    listingType: 'BASIC',
    jobPostingOperationType: 'CREATE',
    integrationContext: `urn:li:organization:${process.env.LINKEDIN_ORGANIZATION_ID}`,
    employmentType: content.employmentType as 'FULL_TIME',
    workplaceType: content.workplaceType as 'REMOTE',
    skillsDescription: content.skills.length > 0
      ? `<ul>${content.skills.map(s => `<li>${s}</li>`).join('')}</ul>`
      : undefined,
  });

  if (!result.success) {
    console.error('[LinkedIn API] Failed, falling back to deeplink:', result.error);
    const fallback = publishViaDeepLink(content);
    return { ...fallback, error: `API fallo (${result.error}). Se genero enlace alternativo.` };
  }

  await updateVacanteLinkedIn(vacante.id, result.linkedinJobId || null);

  return result;
}

function publishViaDeepLink(
  content: ReturnType<typeof formatVacanteForLinkedIn>
): LinkedInPublishResult {
  return executeDeepLinkPublish(content);
}

async function updateVacanteLinkedIn(
  vacanteId: string,
  linkedinJobId: string | null
): Promise<void> {
  await pool.query(
    `UPDATE vacantes
     SET linkedin_job_id = COALESCE($1, linkedin_job_id),
         updated_at = NOW()
     WHERE id = $2`,
    [linkedinJobId, vacanteId]
  );
}

export async function closeLinkedInJob(
  vacante: { id: string; linkedin_job_id: string | null }
): Promise<{ success: boolean; error?: string }> {
  if (!vacante.linkedin_job_id) {
    return { success: true }; // Nothing to close
  }

  const mode = getLinkedInMode();

  if (mode === 'unipile') {
    const client = createUnipileClient();
    if (client) {
      try {
        await client.closeJob(vacante.linkedin_job_id);
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error desconocido';
        console.error('[LinkedIn] Unipile closeJob failed:', msg);
        return { success: false, error: msg };
      }
    }
  }

  if (mode === 'api') {
    const client = createLinkedInJobClient();
    if (client) {
      const result = await client.closeJob(vacante.linkedin_job_id);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true };
    }
  }

  // Deeplink mode: no-op, user manages LinkedIn manually
  return { success: true };
}

export async function clearLinkedInJobId(vacanteId: string): Promise<void> {
  await pool.query(
    `UPDATE vacantes SET linkedin_job_id = NULL, updated_at = NOW() WHERE id = $1`,
    [vacanteId]
  );
}
