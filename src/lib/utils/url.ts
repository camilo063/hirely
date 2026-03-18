/**
 * Returns the application base URL from environment variables.
 * Never falls back to localhost — in production, the env var MUST be set.
 */
export function getAppUrl(): string {
  const url = process.env.NEXTAUTH_URL || process.env.APP_URL || process.env.AUTH_URL;
  if (!url) {
    throw new Error(
      'Missing APP_URL / NEXTAUTH_URL environment variable. Set it to the application base URL (e.g. https://hirely-sepia.vercel.app)'
    );
  }
  // Remove trailing slash for consistency
  return url.replace(/\/+$/, '');
}
