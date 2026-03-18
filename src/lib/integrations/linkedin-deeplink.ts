import { LinkedInPreviewContent, LinkedInPublishResult } from '../types/linkedin.types';

/**
 * MVP mode: Generates a deep link to LinkedIn Job Posting
 * with pre-formatted vacancy content for clipboard.
 */

// Universal LinkedIn job posting URL (works for any logged-in user)
const LINKEDIN_JOB_POST_URL = 'https://www.linkedin.com/job-posting/';

export function generateLinkedInDeepLink(
  content: LinkedInPreviewContent,
): { postUrl: string; clipboardContent: string } {
  // Always use the universal job posting URL.
  // LinkedIn will ask the user to select their company page during the flow.
  const postUrl = LINKEDIN_JOB_POST_URL;

  const clipboardContent = buildClipboardContent(content);

  return { postUrl, clipboardContent };
}

/**
 * Builds clipboard content from the already-formatted description,
 * adding only the apply CTA at the end.
 */
/**
 * Builds clipboard content for the Description field only.
 * Title is copied separately via the modal's "Copiar titulo" button
 * since LinkedIn has separate Cargo and Descripcion fields.
 */
function buildClipboardContent(content: LinkedInPreviewContent): string {
  const lines: string[] = [];

  lines.push(content.description);
  lines.push('');
  lines.push(`Aplica aqui: ${content.applyUrl}`);

  return lines.join('\n');
}

export function executeDeepLinkPublish(
  content: LinkedInPreviewContent,
): LinkedInPublishResult {
  const { postUrl, clipboardContent } = generateLinkedInDeepLink(content);

  return {
    success: true,
    mode: 'deeplink',
    deepLinkUrl: postUrl,
    previewContent: content,
    clipboardContent,
  };
}
