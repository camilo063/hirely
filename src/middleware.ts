import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  const token = await getToken({ req: request, secret });

  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/register');
  const isProtectedRoute = !isAuthPage &&
    !request.nextUrl.pathname.startsWith('/api/auth') &&
    !request.nextUrl.pathname.startsWith('/api/webhooks') &&
    request.nextUrl.pathname !== '/';

  // Redirect logged-in users away from auth pages
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users to login
  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/vacantes/:path*',
    '/candidatos/:path*',
    '/entrevistas/:path*',
    '/evaluaciones/:path*',
    '/contratos/:path*',
    '/onboarding/:path*',
    '/configuracion/:path*',
    '/login',
    '/register',
    '/api/vacantes/:path*',
    '/api/candidatos/:path*',
    '/api/entrevistas/:path*',
    '/api/contratos/:path*',
    '/api/scoring/:path*',
  ],
};
