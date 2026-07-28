import { NextRequest } from 'next/server';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { procesarEmailsProgramados } from '@/lib/services/onboarding.service';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { requireAdmin } from '@/lib/auth/authorization';

// POST — Procesar emails de bienvenida programados
// Callable via: manual button, Vercel Cron, or API key
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Vercel Cron autentica con `Authorization: Bearer $CRON_SECRET`, no con un
    // header `x-vercel-cron-secret` (que no existe). Ademas, sin el `!!` sobre
    // CRON_API_KEY, un `Authorization: Bearer undefined` pasaba el chequeo
    // cuando la variable no estaba definida.
    const authHeader = request.headers.get('authorization');
    const isVercelCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isApiKey = !!process.env.CRON_API_KEY && authHeader === `Bearer ${process.env.CRON_API_KEY}`;

    // El disparo manual queda acotado a la organizacion de quien lo lanza y
    // exige rol admin; solo el cron autenticado barre todas las organizaciones.
    let orgScope: string | undefined;
    if (!isVercelCron && !isApiKey) {
      await requireAuth();
      await requireAdmin();
      orgScope = await getOrgId();
    }

    const result = await procesarEmailsProgramados(orgScope);

    return apiResponse({
      ...result,
      message: `${result.enviados} email(s) enviado(s), ${result.errores} error(es)`,
    });
  } catch (error) {
    return apiError(error);
  }
}

// Vercel Cron invoca con GET. Sin este alias, el cron declarado en vercel.json
// recibia 405 y los emails de bienvenida programados nunca se procesaban.
export const GET = POST;
