import crypto from 'crypto';

/**
 * Devuelve el secret usado para autenticar requests entre endpoints
 * internos del mismo servidor (por ejemplo, scoring async desde el portal).
 *
 * Preferencia:
 *  1. INTERNAL_API_SECRET (recomendado en produccion, >= 16 chars)
 *  2. Fallback derivado: sha256(DATABASE_URL | NEXTAUTH_SECRET)
 *
 * Devuelve string vacio si no hay forma de derivarlo, en cuyo caso el
 * endpoint receptor debe rechazar la peticion.
 */
export function getInternalSecret(): string {
  const explicit = process.env.INTERNAL_API_SECRET;
  if (explicit && explicit.length >= 16) return explicit;

  const fallbackBase = `${process.env.DATABASE_URL || ''}|${process.env.NEXTAUTH_SECRET || ''}`;
  if (fallbackBase === '|') return '';
  return crypto.createHash('sha256').update(fallbackBase).digest('hex');
}
