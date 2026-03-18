import { pool } from '../db';
import { UUID } from '../types/common.types';
import { LinkedInConnectionStatus, LinkedInPost } from '../types/linkedin.types';
import { NotFoundError, AppError } from '../utils/errors';
import * as linkedinClient from '../integrations/linkedin.client';

export async function saveLinkedInToken(
  orgId: UUID,
  userId: UUID,
  tokenData: {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  },
  profile: {
    sub: string;
    name: string;
    email: string;
    picture?: string;
  }
): Promise<void> {
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
  const refreshExpiresAt = tokenData.refresh_token_expires_in
    ? new Date(Date.now() + tokenData.refresh_token_expires_in * 1000)
    : null;

  await pool.query(
    `INSERT INTO linkedin_tokens (
      organization_id, user_id, access_token, expires_at,
      refresh_token, refresh_token_expires_at,
      linkedin_sub, linkedin_name, linkedin_email, linkedin_picture
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET
      access_token = EXCLUDED.access_token,
      expires_at = EXCLUDED.expires_at,
      refresh_token = EXCLUDED.refresh_token,
      refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
      linkedin_sub = EXCLUDED.linkedin_sub,
      linkedin_name = EXCLUDED.linkedin_name,
      linkedin_email = EXCLUDED.linkedin_email,
      linkedin_picture = EXCLUDED.linkedin_picture,
      updated_at = NOW()`,
    [
      orgId,
      userId,
      tokenData.access_token,
      expiresAt,
      tokenData.refresh_token || null,
      refreshExpiresAt,
      profile.sub,
      profile.name,
      profile.email,
      profile.picture || null,
    ]
  );
}

export async function getLinkedInToken(orgId: UUID, userId: UUID) {
  const result = await pool.query(
    `SELECT * FROM linkedin_tokens WHERE organization_id = $1 AND user_id = $2`,
    [orgId, userId]
  );
  return result.rows[0] || null;
}

export async function getConnectionStatus(orgId: UUID, userId: UUID): Promise<LinkedInConnectionStatus> {
  const token = await getLinkedInToken(orgId, userId);

  if (!token) {
    return { connected: false, name: null, email: null, picture: null, expires_at: null };
  }

  const isExpired = new Date(token.expires_at) < new Date();

  return {
    connected: !isExpired,
    name: token.linkedin_name,
    email: token.linkedin_email,
    picture: token.linkedin_picture,
    expires_at: token.expires_at,
  };
}

export async function disconnectLinkedIn(orgId: UUID, userId: UUID): Promise<void> {
  const result = await pool.query(
    `DELETE FROM linkedin_tokens WHERE organization_id = $1 AND user_id = $2`,
    [orgId, userId]
  );

  if (result.rowCount === 0) {
    throw new NotFoundError('Conexion LinkedIn');
  }
}

export async function shareVacanteOnLinkedIn(
  orgId: UUID,
  userId: UUID,
  vacanteId: UUID,
  content: string,
  visibility: 'PUBLIC' | 'CONNECTIONS' = 'PUBLIC'
): Promise<LinkedInPost> {
  const token = await getLinkedInToken(orgId, userId);

  if (!token) {
    throw new AppError('LinkedIn no conectado. Conecta tu cuenta en Configuracion.', 400, 'LINKEDIN_NOT_CONNECTED');
  }

  if (new Date(token.expires_at) < new Date()) {
    throw new AppError('Token de LinkedIn expirado. Reconecta tu cuenta en Configuracion.', 400, 'LINKEDIN_TOKEN_EXPIRED');
  }

  // Insert pending post record
  const insertResult = await pool.query(
    `INSERT INTO linkedin_posts (organization_id, user_id, vacante_id, content, visibility, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING *`,
    [orgId, userId, vacanteId, content, visibility]
  );

  const post = insertResult.rows[0];

  try {
    const result = await linkedinClient.sharePost(
      token.access_token,
      token.linkedin_sub,
      content,
      visibility
    );

    // Update post as published
    const updated = await pool.query(
      `UPDATE linkedin_posts SET status = 'published', linkedin_post_id = $1 WHERE id = $2 RETURNING *`,
      [result.id, post.id]
    );

    return updated.rows[0];
  } catch (error) {
    // Update post as failed
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    await pool.query(
      `UPDATE linkedin_posts SET status = 'failed', error_message = $1 WHERE id = $2`,
      [errorMessage, post.id]
    );

    throw new AppError(`Error publicando en LinkedIn: ${errorMessage}`, 502, 'LINKEDIN_SHARE_FAILED');
  }
}

export async function getPostHistory(vacanteId: UUID): Promise<LinkedInPost[]> {
  const result = await pool.query(
    `SELECT * FROM linkedin_posts WHERE vacante_id = $1 ORDER BY created_at DESC`,
    [vacanteId]
  );
  return result.rows;
}
