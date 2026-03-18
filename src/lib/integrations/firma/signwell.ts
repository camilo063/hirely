/**
 * SignWell Provider — Firma digital real via SignWell API.
 *
 * API docs: https://developers.signwell.com/reference
 * Auth: X-Api-Key header
 */

import type { FirmaProvider, FirmaRequest, FirmaResponse, FirmaEstado } from './interface';

const SIGNWELL_API_URL = process.env.SIGNWELL_API_URL ?? 'https://www.signwell.com/api/v1';
const SIGNWELL_API_KEY = process.env.SIGNWELL_API_KEY ?? '';

async function signwellFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!SIGNWELL_API_KEY) {
    throw new Error('SIGNWELL_API_KEY no configurada. Ver .env.example');
  }

  const url = `${SIGNWELL_API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Api-Key': SIGNWELL_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[SignWell] ${response.status} ${path}:`, body);

    // Retry once on 5xx
    if (response.status >= 500) {
      await new Promise(r => setTimeout(r, 2000));
      const retry = await fetch(url, {
        ...options,
        headers: {
          'X-Api-Key': SIGNWELL_API_KEY,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      if (!retry.ok) {
        const retryBody = await retry.text();
        throw new Error(`SignWell error ${retry.status}: ${retryBody}`);
      }
      return retry;
    }

    throw new Error(`SignWell error ${response.status}: ${body}`);
  }

  return response;
}

export class SignwellProvider implements FirmaProvider {
  async enviarParaFirma(request: FirmaRequest): Promise<FirmaResponse> {
    const payload = {
      test_mode: process.env.NODE_ENV !== 'production',
      name: request.titulo,
      subject: `Firma requerida: ${request.titulo}`,
      message: request.mensaje ?? 'Por favor revisa y firma el documento adjunto.',
      expires_in: request.expiresInDays ?? 30,
      draft: false,
      reminders: true,
      apply_signing_order: request.signatarios.some(s => s.orden),
      files: [
        {
          name: `${request.titulo}.html`,
          file_base64: Buffer.from(request.htmlContenido).toString('base64'),
        },
      ],
      recipients: request.signatarios.map(s => ({
        id: `recipient_${s.email.replace(/[@.]/g, '_')}`,
        name: s.nombre,
        email: s.email,
        signing_order: s.orden ?? 1,
        send_email: true,
      })),
      api_application_id: 'hirely',
      metadata: { contrato_id: request.contratoId },
      callback_url: request.webhookUrl,
    };

    const response = await signwellFetch('/documents/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    return {
      externalId: data.id,
      signingUrl: data.recipients?.[0]?.embedded_signing_url ?? undefined,
      status: 'sent',
    };
  }

  async obtenerEstado(externalId: string): Promise<FirmaEstado> {
    const response = await signwellFetch(`/documents/${externalId}`);
    const data = await response.json();

    const statusMap: Record<string, FirmaEstado['status']> = {
      pending: 'pending',
      sent: 'sent',
      completed: 'completed',
      declined: 'declined',
      expired: 'expired',
    };

    return {
      externalId,
      status: statusMap[data.status] ?? 'pending',
      signatarios: (data.recipients ?? []).map((r: Record<string, string | boolean>) => ({
        email: r.email as string,
        nombre: r.name as string,
        firmado: r.status === 'completed',
        firmado_at: r.completed_at as string | undefined,
      })),
      completado_at: data.completed_at ?? undefined,
    };
  }

  async descargarDocumentoFirmado(externalId: string): Promise<Buffer> {
    const response = await signwellFetch(`/documents/${externalId}/completed_pdf`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async cancelarFirma(externalId: string): Promise<void> {
    await signwellFetch(`/documents/${externalId}`, { method: 'DELETE' });
  }
}
