import { auth } from './config';
import { UnauthorizedError } from '../utils/errors';

export async function getSession() {
  const session = await auth();
  return session;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new UnauthorizedError('No autorizado');
  }
  return session;
}

export async function getOrgId(): Promise<string> {
  const session = await requireAuth();
  const user = session.user as Record<string, unknown>;
  return (user?.organizationId as string) || '';
}

export async function getUserId(): Promise<string> {
  const session = await requireAuth();
  const user = session.user as Record<string, unknown>;
  return (user?.id as string) || '';
}

export async function getUserRole(): Promise<string> {
  const session = await requireAuth();
  const user = session.user as Record<string, unknown>;
  return (user?.role as string) || 'viewer';
}
