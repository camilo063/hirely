import type {
  UnipileCreateJobPayload,
  UnipileJobDraft,
  UnipileJobPublished,
  UnipileApplicantList,
  UnipileApplicant,
  UnipileJobList,
  UnipileSearchParameter,
} from '@/lib/types/unipile.types';

/**
 * HTTP client for Unipile API.
 * Unipile acts as an intermediary between Hirely and LinkedIn,
 * enabling job posting and applicant retrieval without LinkedIn partnership.
 *
 * Docs: https://developer.unipile.com/reference/
 */

interface UnipileConfig {
  baseUrl: string;
  apiKey: string;
  accountId: string;
}

export class UnipileClient {
  private config: UnipileConfig;

  constructor(config: UnipileConfig) {
    this.config = config;
  }

  private get headers(): Record<string, string> {
    return {
      'accept': 'application/json',
      'content-type': 'application/json',
      'X-API-KEY': this.config.apiKey,
    };
  }

  private get baseUrl(): string {
    return `${this.config.baseUrl}/api/v1`;
  }

  async searchParameters(
    type: 'LOCATION' | 'JOB_TITLE' | 'COMPANY',
    query: string
  ): Promise<UnipileSearchParameter[]> {
    const url = new URL(`${this.baseUrl}/linkedin/search/parameters`);
    url.searchParams.set('account_id', this.config.accountId);
    url.searchParams.set('type', type);
    url.searchParams.set('query', query);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.items || [];
  }

  resolveLocationId(locationText: string): string {
    // Unipile search endpoint returns unreliable results,
    // so we use a static map of known Colombian LinkedIn geo IDs.
    const loc = (locationText || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const LOCATION_MAP: Record<string, string> = {
      'bogota':      '90010133',
      'medellin':    '90010137',
      'cali':        '90010135',
      'barranquilla':'90010134',
      'cartagena':   '90010136',
      'bucaramanga': '90010138',
      'pereira':     '90010379',
      'colombia':    '100876405',
    };
    for (const [key, id] of Object.entries(LOCATION_MAP)) {
      if (loc.includes(key)) return id;
    }
    // Default: Bogota D.C. Metropolitan Area
    return '90010133';
  }

  async createJobDraft(payload: UnipileCreateJobPayload): Promise<UnipileJobDraft> {
    const locationId = this.resolveLocationId(payload.location || '');

    // Transform to Unipile's actual API format
    const body = {
      account_id: this.config.accountId,
      job_title: { text: payload.title },
      description: payload.descriptionHtml || payload.description,
      workplace: payload.workplace,
      location: locationId,
      ...(payload.company_name && { company: { text: payload.company_name } }),
      ...(payload.apply_url && { apply_url: payload.apply_url }),
    };

    const response = await fetch(`${this.baseUrl}/linkedin/jobs`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Unipile createJobDraft failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async publishJob(jobId: string, mode: 'FREE' | 'PROMOTED' = 'FREE'): Promise<UnipileJobPublished> {
    const response = await fetch(`${this.baseUrl}/linkedin/jobs/${jobId}/publish`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ account_id: this.config.accountId, mode }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Unipile publishJob failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async listJobs(cursor?: string): Promise<UnipileJobList> {
    const url = new URL(`${this.baseUrl}/linkedin/jobs`);
    url.searchParams.set('account_id', this.config.accountId);
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Unipile listJobs failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async getJob(jobId: string): Promise<UnipileJobDraft> {
    const response = await fetch(`${this.baseUrl}/linkedin/jobs/${jobId}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Unipile getJob failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async listApplicants(jobId: string, cursor?: string): Promise<UnipileApplicantList> {
    const url = new URL(`${this.baseUrl}/linkedin/jobs/${jobId}/applicants`);
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Unipile listApplicants failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async getApplicant(applicantId: string): Promise<UnipileApplicant> {
    const response = await fetch(
      `${this.baseUrl}/linkedin/jobs/applicants/${applicantId}`,
      {
        method: 'GET',
        headers: this.headers,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Unipile getApplicant failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async closeJob(jobId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/linkedin/jobs/${jobId}/close`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ account_id: this.config.accountId }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Unipile closeJob failed: ${response.status} - ${error}`);
    }
  }

  isConfigured(): boolean {
    return !!(this.config.baseUrl && this.config.apiKey && this.config.accountId);
  }
}

export function createUnipileClient(): UnipileClient | null {
  const baseUrl = process.env.UNIPILE_API_URL;
  const apiKey = process.env.UNIPILE_API_KEY;
  const accountId = process.env.UNIPILE_ACCOUNT_ID;

  if (!baseUrl || !apiKey || !accountId) {
    return null;
  }

  return new UnipileClient({ baseUrl, apiKey, accountId });
}
