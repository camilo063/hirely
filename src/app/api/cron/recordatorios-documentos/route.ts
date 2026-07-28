import { NextRequest } from 'next/server';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { enviarRecordatoriosDocumentos } from '@/lib/services/portal-documentos.service';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { requireAdmin } from '@/lib/auth/authorization';

/**
 * Recordatorios de documentos pendientes.
 *
 * Se declara en vercel.json para correr a diario. El servicio decide a quien le
 * toca (dias 2, 5 y 10 desde la seleccion) y nunca repite el mismo recordatorio.
 *
 * Acepta GET y POST: Vercel Cron invoca con GET, y POST queda disponible para
 * dispararlo a mano desde el panel o con la API key.
 */
export const maxDuration = 60;

async function handler(request: NextRequest) {
  try {
    // Vercel Cron autentica con `Authorization: Bearer $CRON_SECRET`.
    // NO envia ningun header `x-vercel-cron-secret` — esperar ese header (como
    // hace el cron de onboarding) hace que la invocacion diaria caiga en
    // requireAuth() y devuelva 401 siempre: la tarea nunca llega a ejecutarse.
    const authHeader = request.headers.get('authorization');
    const isVercelCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isApiKey = !!process.env.CRON_API_KEY && authHeader === `Bearer ${process.env.CRON_API_KEY}`;

    // El disparo manual queda acotado a la organizacion de quien lo lanza y
    // exige rol admin; solo el cron autenticado barre todas las organizaciones.
    // Antes bastaba cualquier sesion y se procesaban TODAS las empresas.
    let orgScope: string | undefined;
    if (!isVercelCron && !isApiKey) {
      await requireAuth();
      await requireAdmin();
      orgScope = await getOrgId();
    }

    const resultado = await enviarRecordatoriosDocumentos(orgScope);

    return apiResponse({
      ...resultado,
      message: `${resultado.enviados} recordatorio(s) enviado(s) de ${resultado.revisados} candidato(s) revisado(s), ${resultado.errores} error(es)`,
    });
  } catch (error) {
    return apiError(error);
  }
}

export const GET = handler;
export const POST = handler;
