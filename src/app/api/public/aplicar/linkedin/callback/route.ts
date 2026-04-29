import { NextRequest, NextResponse } from 'next/server';
import { decodeOAuthState } from '@/lib/utils/oauth-state';
import { exchangeCandidateCodeForToken, getProfile } from '@/lib/integrations/linkedin.client';
import { findOrCreateCandidato, createPublicAplicacion } from '@/lib/services/public-apply.service';

export const maxDuration = 15;

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  // LinkedIn denied or user cancelled
  if (error || !code || !state) {
    return NextResponse.redirect(new URL('/?error=linkedin_denied', request.url));
  }

  // Verify state signature
  const payload = decodeOAuthState(state);
  if (!payload) {
    return NextResponse.redirect(new URL('/?error=invalid_state', request.url));
  }

  const { vacante_id, org_id } = payload;

  try {
    // Exchange code for token (used once, then discarded)
    const tokenRes = await exchangeCandidateCodeForToken(code);
    const profile = await getProfile(tokenRes.access_token);

    // Split name into nombre/apellido
    const nameParts = (profile.name || '').split(' ');
    const nombre = nameParts[0] || 'Sin nombre';
    const apellido = nameParts.slice(1).join(' ') || '';

    // Build LinkedIn profile URL from sub
    const linkedinUrl = `https://www.linkedin.com/in/${profile.sub}`;

    // Find or create candidato
    const candidato = await findOrCreateCandidato(org_id, {
      nombre,
      apellido,
      email: profile.email,
      linkedin_url: linkedinUrl,
    });

    // Create aplicacion
    const { alreadyApplied } = await createPublicAplicacion(org_id, vacante_id, candidato.id);

    const redirectUrl = new URL(`/empleo/${vacante_id}/gracias`, request.url);
    if (alreadyApplied) {
      redirectUrl.searchParams.set('ya_aplicaste', '1');
    }
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('[PublicApply] Callback error:', err);
    return NextResponse.redirect(
      new URL(`/empleo/${vacante_id}?error=aplicacion_fallida`, request.url)
    );
  }
}
