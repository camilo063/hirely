/**
 * LinkedIn OAuth 2.0 Client
 * Pure HTTP wrapper — no DB access.
 */

import { LinkedInTokenResponse, LinkedInProfile, LinkedInUGCPayload, LinkedInJobPayload, LinkedInPublishResult } from '../types/linkedin.types';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_API_URL = 'https://api.linkedin.com';

// Base scopes for "Sign In with LinkedIn using OpenID Connect" product
// w_member_social requires "Share on LinkedIn" product — only include if available
const BASE_SCOPES = ['openid', 'profile', 'email'];
const SCOPES = process.env.LINKEDIN_ENABLE_SHARE === 'true'
  ? [...BASE_SCOPES, 'w_member_social']
  : BASE_SCOPES;
const CANDIDATE_SCOPES = ['openid', 'profile', 'email'];

function getClientId(): string {
  const id = process.env.LINKEDIN_CLIENT_ID;
  if (!id) throw new Error('LINKEDIN_CLIENT_ID no configurado');
  return id;
}

function getClientSecret(): string {
  const secret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!secret) throw new Error('LINKEDIN_CLIENT_SECRET no configurado');
  return secret;
}

function getRedirectUri(): string {
  return process.env.LINKEDIN_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/linkedin/callback`;
}

function getCandidateRedirectUri(): string {
  return process.env.LINKEDIN_CANDIDATE_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/public/aplicar/linkedin/callback`;
}

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    state,
    scope: SCOPES.join(' '),
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<LinkedInTokenResponse> {
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[LinkedIn] Token exchange failed:', res.status, body);
    let detail = '';
    try {
      const parsed = JSON.parse(body);
      detail = parsed.error_description || parsed.error || '';
    } catch { /* ignore */ }
    throw new Error(`LinkedIn token exchange failed: ${res.status}${detail ? ` - ${detail}` : ''}`);
  }

  return res.json();
}

export async function getProfile(accessToken: string): Promise<LinkedInProfile> {
  const res = await fetch(`${LINKEDIN_API_URL}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[LinkedIn] Profile fetch failed:', res.status, body);
    throw new Error(`LinkedIn profile fetch failed: ${res.status}`);
  }

  return res.json();
}

export async function sharePost(
  accessToken: string,
  linkedInSub: string,
  text: string,
  visibility: 'PUBLIC' | 'CONNECTIONS' = 'PUBLIC'
): Promise<{ id: string }> {
  const payload: LinkedInUGCPayload = {
    author: `urn:li:person:${linkedInSub}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': visibility,
    },
  };

  const res = await fetch(`${LINKEDIN_API_URL}/v2/ugcPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[LinkedIn] Share post failed:', res.status, body);
    throw new Error(`LinkedIn share failed: ${res.status}`);
  }

  const data = await res.json();
  return { id: data.id };
}

// --- Candidate OAuth (public apply flow) ---

export function getCandidateAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    redirect_uri: getCandidateRedirectUri(),
    state,
    scope: CANDIDATE_SCOPES.join(' '),
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCandidateCodeForToken(code: string): Promise<LinkedInTokenResponse> {
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getCandidateRedirectUri(),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[LinkedIn] Candidate token exchange failed:', res.status, body);
    throw new Error(`LinkedIn candidate token exchange failed: ${res.status}`);
  }

  return res.json();
}

// --- LinkedIn Job Posting API Client (for future API mode) ---

interface LinkedInJobClientConfig {
  clientId: string;
  clientSecret: string;
  organizationId: string;
  contractId?: string;
}

export class LinkedInJobClient {
  private config: LinkedInJobClientConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: LinkedInJobClientConfig) {
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    const response = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LinkedIn OAuth failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
    return this.accessToken!;
  }

  async postJob(payload: LinkedInJobPayload): Promise<LinkedInPublishResult> {
    try {
      const token = await this.getAccessToken();

      const body = {
        elements: [{
          externalJobPostingId: payload.externalJobPostingId,
          title: payload.title,
          description: payload.description,
          location: payload.location,
          listingType: payload.listingType || 'BASIC',
          jobPostingOperationType: payload.jobPostingOperationType || 'CREATE',
          integrationContext: `urn:li:organization:${this.config.organizationId}`,
          companyApplyUrl: payload.companyApplyUrl,
          ...(this.config.contractId && {
            contract: `urn:li:contract:${this.config.contractId}`,
          }),
          ...(payload.workplaceType && { workplaceType: payload.workplaceType }),
          ...(payload.employmentType && { employmentType: payload.employmentType }),
          ...(payload.skillsDescription && { skillsDescription: payload.skillsDescription }),
          listedAt: Date.now(),
        }],
      };

      const response = await fetch(`${LINKEDIN_API_URL}/rest/simpleJobPostings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-restli-method': 'batch_create',
          'Linkedin-Version': '202502',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LinkedIn API error: ${response.status} - ${error}`);
      }

      return {
        success: true,
        mode: 'api',
        linkedinJobId: payload.externalJobPostingId,
      };
    } catch (error) {
      return {
        success: false,
        mode: 'api',
        error: error instanceof Error ? error.message : 'Error desconocido al publicar en LinkedIn',
      };
    }
  }

  async closeJob(externalJobPostingId: string): Promise<LinkedInPublishResult> {
    return this.postJob({
      externalJobPostingId,
      title: '',
      description: '',
      location: '',
      companyApplyUrl: '',
      listingType: 'BASIC',
      jobPostingOperationType: 'CLOSE',
      integrationContext: '',
    });
  }

  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret && this.config.organizationId);
  }
}

export function createLinkedInJobClient(): LinkedInJobClient | null {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const organizationId = process.env.LINKEDIN_ORGANIZATION_ID;

  if (!clientId || !clientSecret || !organizationId) {
    return null;
  }

  return new LinkedInJobClient({
    clientId,
    clientSecret,
    organizationId,
    contractId: process.env.LINKEDIN_CONTRACT_ID,
  });
}
