/**
 * Mock Firma Provider — para desarrollo y tests.
 * Simula el comportamiento de un proveedor real sin hacer llamadas externas.
 */

import type { FirmaProvider, FirmaRequest, FirmaResponse, FirmaEstado } from './interface';

const mockStore = new Map<string, { request: FirmaRequest; createdAt: number }>();

export class MockFirmaProvider implements FirmaProvider {
  async enviarParaFirma(request: FirmaRequest): Promise<FirmaResponse> {
    const externalId = `mock_${request.contratoId}_${Date.now()}`;

    mockStore.set(externalId, { request, createdAt: Date.now() });

    console.log(`[Firma Mock] Documento enviado: ${externalId}`);
    console.log(`[Firma Mock] Signatarios: ${request.signatarios.map(s => s.email).join(', ')}`);

    return {
      externalId,
      signingUrl: `http://localhost:3500/mock-firma/${externalId}`,
      status: 'sent',
    };
  }

  async obtenerEstado(externalId: string): Promise<FirmaEstado> {
    const stored = mockStore.get(externalId);
    const elapsed = stored ? Date.now() - stored.createdAt : 0;

    // Mock: after 30 seconds, consider it completed (for quick testing)
    const isCompleted = elapsed > 30_000;

    return {
      externalId,
      status: isCompleted ? 'completed' : 'sent',
      signatarios: (stored?.request.signatarios ?? []).map(s => ({
        email: s.email,
        nombre: s.nombre,
        firmado: isCompleted,
        firmado_at: isCompleted ? new Date().toISOString() : undefined,
      })),
      completado_at: isCompleted ? new Date().toISOString() : undefined,
    };
  }

  async descargarDocumentoFirmado(externalId: string): Promise<Buffer> {
    const stored = mockStore.get(externalId);
    const html = stored?.request.htmlContenido ?? '<p>Documento firmado (mock)</p>';
    return Buffer.from(html, 'utf-8');
  }

  async cancelarFirma(externalId: string): Promise<void> {
    mockStore.delete(externalId);
    console.log(`[Firma Mock] Documento cancelado: ${externalId}`);
  }
}
