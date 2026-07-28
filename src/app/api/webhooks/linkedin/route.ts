import { NextRequest } from 'next/server';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { verificarFirmaHmac, extraerFirma } from '@/lib/integrations/webhook-signature';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const verificacion = verificarFirmaHmac(
      rawBody,
      extraerFirma(request.headers),
      process.env.LINKEDIN_WEBHOOK_SECRET
    );
    if (!verificacion.valido) {
      console.warn('[Webhook LinkedIn] Rechazado:', verificacion.motivo);
      return apiResponse({ received: true, processed: false }, 401);
    }

    // Este webhook aun no procesa nada; se registra recortado para no permitir
    // que un tercero infle los logs con contenido arbitrario.
    console.log('[Webhook LinkedIn] Received:', rawBody.substring(0, 500));

    // TODO: Process LinkedIn webhook events
    // - New application received
    // - Job status changed
    // - Application status update

    return apiResponse({ received: true });
  } catch (error) {
    return apiError(error);
  }
}
