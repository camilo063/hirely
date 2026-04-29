import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getAuthorizationUrl } from '@/lib/integrations/linkedin.client';
import { apiError } from '@/lib/utils/api-response';
import crypto from 'crypto';

export const maxDuration = 30;

export async function GET() {
  try {
    await requireAuth();

    const state = crypto.randomBytes(32).toString('hex');
    const authUrl = getAuthorizationUrl(state);

    const response = NextResponse.redirect(authUrl);

    response.cookies.set('linkedin_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    return apiError(error);
  }
}
