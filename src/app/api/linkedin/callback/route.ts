import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { exchangeCodeForToken, getProfile } from '@/lib/integrations/linkedin.client';
import { saveLinkedInToken } from '@/lib/services/linkedin.service';
import { getAppUrl } from '@/lib/utils/url';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const baseUrl = getAppUrl();
  const redirectBase = `${baseUrl}/configuracion?tab=integraciones`;

  try {
    await requireAuth();
    const orgId = await getOrgId();
    const userId = await getUserId();

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // LinkedIn returned an error
    if (error) {
      const desc = searchParams.get('error_description') || 'Acceso denegado';
      return NextResponse.redirect(`${redirectBase}&linkedin_error=${encodeURIComponent(desc)}`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${redirectBase}&linkedin_error=${encodeURIComponent('Parametros faltantes')}`);
    }

    // Validate CSRF state
    const savedState = request.cookies.get('linkedin_oauth_state')?.value;
    if (!savedState || savedState !== state) {
      return NextResponse.redirect(`${redirectBase}&linkedin_error=${encodeURIComponent('Estado invalido. Intenta de nuevo.')}`);
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code);

    // Get user profile
    const profile = await getProfile(tokenData.access_token);

    // Save to database
    await saveLinkedInToken(orgId, userId, tokenData, profile);

    // Redirect with success
    const response = NextResponse.redirect(`${redirectBase}&linkedin_success=true`);

    // Clear state cookie
    response.cookies.delete('linkedin_oauth_state');

    return response;
  } catch (error) {
    console.error('[LinkedIn Callback] Error:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.redirect(`${redirectBase}&linkedin_error=${encodeURIComponent(message)}`);
  }
}
