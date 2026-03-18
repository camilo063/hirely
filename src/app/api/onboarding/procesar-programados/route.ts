import { NextRequest } from 'next/server';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { procesarEmailsProgramados } from '@/lib/services/onboarding.service';
import { requireAuth } from '@/lib/auth/middleware';

// POST — Procesar emails de bienvenida programados
// Callable via: manual button, Vercel Cron, or API key
export async function POST(request: NextRequest) {
  try {
    // Check for Vercel Cron secret or API key
    const cronSecret = request.headers.get('x-vercel-cron-secret');
    const authHeader = request.headers.get('authorization');
    const isVercelCron = cronSecret && cronSecret === process.env.CRON_SECRET;
    const isApiKey = authHeader === `Bearer ${process.env.CRON_API_KEY}`;

    if (!isVercelCron && !isApiKey) {
      // Fall back to session auth
      await requireAuth();
    }

    const result = await procesarEmailsProgramados();

    return apiResponse({
      ...result,
      message: `${result.enviados} email(s) enviado(s), ${result.errores} error(es)`,
    });
  } catch (error) {
    return apiError(error);
  }
}
