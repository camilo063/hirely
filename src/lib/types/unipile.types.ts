/**
 * Types for Unipile API responses.
 * Docs: https://developer.unipile.com/reference/
 */

export interface UnipileJobDraft {
  object: string;
  id?: string;
  job_id?: string;
  provider_id?: string;
  status?: 'DRAFT' | 'OPEN' | 'CLOSED';
  publish_options?: {
    free?: { eligible: boolean; ineligible_reason?: string };
    promoted?: { currency?: string };
  };
}

export interface UnipileJobPublished {
  object: string;
  id?: string;
  job_id?: string;
  provider_id?: string;
  status?: 'OPEN';
}

export interface UnipileCreateJobPayload {
  title: string;
  description: string;
  descriptionHtml: string;
  company_name?: string;
  location?: string;
  workplace: 'ON_SITE' | 'HYBRID' | 'REMOTE';
  employment_type?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'TEMPORARY' | 'INTERNSHIP';
  experience_level?: 'ENTRY_LEVEL' | 'ASSOCIATE' | 'MID_SENIOR_LEVEL' | 'DIRECTOR' | 'EXECUTIVE';
  skills?: string[];
  apply_url?: string;
}

export interface UnipileSearchParameter {
  object: string;
  title: string;
  id: string;
}

export interface UnipilePublishJobPayload {
  mode: 'FREE' | 'PROMOTED';
}

export interface UnipileApplicant {
  object: string;
  id: string;
  provider_id: string;
  name: string;
  headline?: string;
  profile_url?: string;
  email?: string;
  phone?: string;
  location?: string;
  resume_url?: string;
  applied_at: string;
  status: 'NEW' | 'REVIEWED' | 'REJECTED' | 'HIRED';
  experience?: UnipileExperience[];
  education?: UnipileEducation[];
  skills?: string[];
}

export interface UnipileExperience {
  title: string;
  company: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

export interface UnipileEducation {
  school: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
}

export interface UnipileApplicantList {
  object: string;
  items: UnipileApplicant[];
  cursor?: string;
}

export interface UnipileJobList {
  object: string;
  items: UnipileJobDraft[];
  cursor?: string;
}
