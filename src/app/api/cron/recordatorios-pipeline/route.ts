import { NextRequest } from 'next/server';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { ejecutarRecordatoriosPipeline } from '@/lib/services/recordatorios-pipeline.service';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { requireAdmin } from '@/lib/auth/authorization';

/**
 * Recordatorios de evaluaciones tecnicas vencidas y contratos estancados en firma.
 *
 * Se declara en vercel.json para correr a diario. Mismo patron de auth que
 * `recordatorios-documentos`: Vercel Cron autentica con
 * `Authorization: Bearer $CRON_SECRET` (no con `x-vercel-cron-secret`).
 *
 * Acepta GET y POST: Vercel Cron invoca con GET, y POST queda disponible para
 * dispararlo a mano desde el panel o con la API key.
 */
export const maxDuration = 60;

async function handler(request: NextRequest) {
  try {
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

    const resultado = await ejecutarRecordatoriosPipeline(orgScope);

    return apiResponse({
      ...resultado,
      message: `${resultado.evaluacionesExpiradas} evaluacion(es) marcada(s) como expirada(s), ${resultado.contratosEstancados} contrato(s) estancado(s) notificado(s)`,
    });
  } catch (error) {
    return apiError(error);
  }
}

export const GET = handler;
export const POST = handler;
