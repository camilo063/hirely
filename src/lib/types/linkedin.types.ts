import { UUID } from './common.types';

export interface LinkedInToken {
  id: UUID;
  organization_id: UUID;
  user_id: UUID;
  access_token: string;
  expires_at: Date;
  refresh_token: string | null;
  refresh_token_expires_at: Date | null;
  linkedin_sub: string;
  linkedin_name: string | null;
  linkedin_email: string | null;
  linkedin_picture: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface LinkedInPost {
  id: UUID;
  organization_id: UUID;
  user_id: UUID;
  vacante_id: UUID;
  linkedin_post_id: string | null;
  content: string;
  visibility: string;
  status: 'pending' | 'published' | 'failed';
  error_message: string | null;
  created_at: Date;
}

export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
}

export interface LinkedInProfile {
  sub: string;
  name: string;
  email: string;
  picture?: string;
}

export interface LinkedInConnectionStatus {
  connected: boolean;
  name: string | null;
  email: string | null;
  picture: string | null;
  expires_at: Date | null;
}

export interface ShareOnLinkedInInput {
  vacante_id: UUID;
  content: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
}

export interface LinkedInUGCPayload {
  author: string;
  lifecycleState: 'PUBLISHED';
  specificContent: {
    'com.linkedin.ugc.ShareContent': {
      shareCommentary: { text: string };
      shareMediaCategory: 'NONE';
    };
  };
  visibility: {
    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' | 'CONNECTIONS';
  };
}

// --- LinkedIn Job Publishing Types ---

export interface LinkedInJobPayload {
  externalJobPostingId: string;
  title: string;
  description: string;
  location: string;
  companyApplyUrl: string;
  listingType: 'BASIC' | 'PREMIUM';
  jobPostingOperationType: 'CREATE' | 'UPDATE' | 'CLOSE' | 'RENEW';
  integrationContext: string;
  employmentType?: LinkedInEmploymentType;
  workplaceType?: LinkedInWorkplaceType;
  skillsDescription?: string;
}

export type LinkedInEmploymentType =
  | 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'TEMPORARY' | 'INTERNSHIP' | 'OTHER';

export type LinkedInWorkplaceType =
  | 'ON_SITE' | 'HYBRID' | 'REMOTE';

export type LinkedInExperienceLevel =
  | 'ENTRY_LEVEL' | 'ASSOCIATE' | 'MID_SENIOR_LEVEL' | 'DIRECTOR' | 'EXECUTIVE';

export type LinkedInIntegrationMode = 'deeplink' | 'api' | 'unipile';

export interface LinkedInPublishResult {
  success: boolean;
  mode: LinkedInIntegrationMode;
  linkedinJobId?: string;
  deepLinkUrl?: string;
  previewContent?: LinkedInPreviewContent;
  clipboardContent?: string;
  error?: string;
}

export interface LinkedInPreviewContent {
  title: string;
  description: string;
  descriptionHtml: string;
  location: string;
  employmentType: string;
  workplaceType: string;
  skills: string[];
  salaryRange?: string;
  applyUrl: string;
}
