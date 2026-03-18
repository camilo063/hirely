import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getAuthUrl } from '@/lib/integrations/google-calendar.client';
import { getAppUrl } from '@/lib/utils/url';
import { randomBytes } from 'crypto';

export async function GET() {
  try {
    await requireAuth();

    const state = randomBytes(32).toString('hex');
    const url = getAuthUrl(state);

    const response = NextResponse.redirect(url);
    response.cookies.set('google_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL('/login', getAppUrl()));
  }
}
