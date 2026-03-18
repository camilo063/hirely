import { NextRequest, NextResponse } from 'next/server';
import { getOrgId, getUserId } from '@/lib/auth/middleware';
import { intercambiarCodigo } from '@/lib/integrations/google-calendar.client';
import { pool } from '@/lib/db';
import { getAppUrl } from '@/lib/utils/url';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    const orgId = await getOrgId();

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const baseUrl = getAppUrl();

    if (error) {
      return NextResponse.redirect(`${baseUrl}/configuracion?tab=integraciones&google=error&message=${error}`);
    }

    if (!code) {
      return NextResponse.redirect(`${baseUrl}/configuracion?tab=integraciones&google=error&message=no_code`);
    }

    // Verify CSRF state
    const savedState = request.cookies.get('google_oauth_state')?.value;
    if (!savedState || savedState !== state) {
      return NextResponse.redirect(`${baseUrl}/configuracion?tab=integraciones&google=error&message=invalid_state`);
    }

    // Exchange code for tokens
    const tokenData = await intercambiarCodigo(code);

    // Upsert token
    await pool.query(
      `INSERT INTO google_tokens (organization_id, user_id, access_token, refresh_token, expires_at, scopes, google_account_email, google_account_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (organization_id, user_id) DO UPDATE SET
         access_token = $3, refresh_token = COALESCE($4, google_tokens.refresh_token),
         expires_at = $5, scopes = $6, google_account_email = $7, google_account_name = $8,
         is_active = true, updated_at = NOW()`,
      [
        orgId, userId, tokenData.accessToken, tokenData.refreshToken,
        tokenData.expiresAt?.toISOString() ?? null, tokenData.scopes,
        tokenData.email, tokenData.name,
      ]
    );

    const response = NextResponse.redirect(`${baseUrl}/configuracion?tab=integraciones&google=conectado`);
    response.cookies.delete('google_oauth_state');
    return response;
  } catch (err) {
    console.error('[Google OAuth Callback] Error:', err);
    const baseUrl = getAppUrl();
    return NextResponse.redirect(`${baseUrl}/configuracion?tab=integraciones&google=error`);
  }
}
