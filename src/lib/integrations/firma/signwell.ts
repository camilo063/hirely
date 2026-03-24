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
    // Inject SignWell text tags into the HTML for signature placement
    // SignWell uses [sw_sign_X] text tags to place signature fields on HTML documents
    const recipientIds = request.signatarios.map(s => `recipient_${s.email.replace(/[@.]/g, '_')}`);

    let htmlWithTags = request.htmlContenido;
    // Check if HTML already has signature tags
    if (!htmlWithTags.includes('[sw_')) {
      // Append signature block at the end of the document, before closing </div>
      const signatureBlock = `
        <div style="margin-top: 60px; page-break-inside: avoid;">
          <hr style="border: none; border-top: 1px solid #ccc; margin-bottom: 40px;" />
          <div style="display: flex; justify-content: space-between; gap: 40px;">
            ${request.signatarios.map((s, idx) => `
              <div style="flex: 1; text-align: center;">
                <p style="font-size: 12px; color: #666; margin-bottom: 30px;">${s.rol === 'empresa' ? 'EL EMPLEADOR' : 'EL TRABAJADOR'}</p>
                <div style="margin-bottom: 8px;">[sw_sign_${recipientIds[idx]}]</div>
                <div style="margin-bottom: 4px;">[sw_date_${recipientIds[idx]}]</div>
                <div style="border-top: 1px solid #000; padding-top: 8px; font-size: 12px;">
                  <strong>${s.nombre}</strong>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // Insert before the last closing </div> of the document
      const lastDivIdx = htmlWithTags.lastIndexOf('</div>');
      if (lastDivIdx > 0) {
        htmlWithTags = htmlWithTags.slice(0, lastDivIdx) + signatureBlock + htmlWithTags.slice(lastDivIdx);
      } else {
        htmlWithTags += signatureBlock;
      }
    }

    const payload = {
      test_mode: process.env.SIGNWELL_TEST_MODE !== 'false',
      name: request.titulo,
      subject: `Firma requerida: ${request.titulo}`,
      message: request.mensaje ?? 'Por favor revisa y firma el documento adjunto.',
      expires_in: request.expiresInDays ?? 30,
      draft: false,
      reminders: true,
      apply_signing_order: request.signatarios.some(s => s.orden),
      text_tags: true,
      files: [
        {
          name: `${request.titulo}.html`,
          file_base64: Buffer.from(htmlWithTags).toString('base64'),
        },
      ],
      recipients: request.signatarios.map(s => ({
        id: `recipient_${s.email.replace(/[@.]/g, '_')}`,
        name: s.nombre,
        email: s.email,
        signing_order: s.orden ?? 1,
      })),
      metadata: { contrato_id: request.contratoId },
      ...(request.webhookUrl ? { callback_url: request.webhookUrl } : {}),
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
