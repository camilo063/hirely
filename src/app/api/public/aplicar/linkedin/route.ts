import { NextRequest, NextResponse } from 'next/server';
import { encodeOAuthState } from '@/lib/utils/oauth-state';
import { getCandidateAuthorizationUrl } from '@/lib/integrations/linkedin.client';
import { getPublicVacante } from '@/lib/services/public-apply.service';

export const maxDuration = 15;

export async function GET(request: NextRequest) {
  const vacanteId = request.nextUrl.searchParams.get('vacante_id');
  if (!vacanteId) {
    return NextResponse.json({ error: 'vacante_id requerido' }, { status: 400 });
  }

  try {
    // Verify vacancy exists and is published
    const vacante = await getPublicVacante(vacanteId);

    const state = encodeOAuthState({
      vacante_id: vacante.id,
      org_id: vacante.organization_id,
    });

    const authUrl = getCandidateAuthorizationUrl(state);
    return NextResponse.redirect(authUrl);
  } catch {
    return NextResponse.redirect(
      new URL(`/empleo/${vacanteId}?error=vacante_no_disponible`, request.url)
    );
  }
}
