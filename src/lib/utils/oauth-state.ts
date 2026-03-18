import { createHmac, randomBytes } from 'crypto';

interface OAuthStatePayload {
  vacante_id: string;
  org_id: string;
}

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET no configurado');
  return secret;
}

function sign(data: string): string {
  return createHmac('sha256', getSecret()).update(data).digest('hex');
}

/**
 * Encode vacancy context into an HMAC-signed OAuth state parameter.
 * Format: base64(json) + '.' + hmac
 */
export function encodeOAuthState(payload: OAuthStatePayload): string {
  const nonce = randomBytes(8).toString('hex');
  const data = JSON.stringify({ ...payload, nonce, ts: Date.now() });
  const b64 = Buffer.from(data).toString('base64url');
  const hmac = sign(b64);
  return `${b64}.${hmac}`;
}

/**
 * Decode and verify an HMAC-signed OAuth state parameter.
 * Returns null if tampered, expired (>10 min), or malformed.
 */
export function decodeOAuthState(state: string): OAuthStatePayload | null {
  const dotIndex = state.indexOf('.');
  if (dotIndex === -1) return null;

  const b64 = state.substring(0, dotIndex);
  const hmac = state.substring(dotIndex + 1);

  if (sign(b64) !== hmac) return null;

  try {
    const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString());
    // Reject states older than 10 minutes
    if (Date.now() - parsed.ts > 10 * 60 * 1000) return null;
    return { vacante_id: parsed.vacante_id, org_id: parsed.org_id };
  } catch {
    return null;
  }
}
