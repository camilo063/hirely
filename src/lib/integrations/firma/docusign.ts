/**
 * DocuSign Provider — placeholder enterprise implementation.
 * Available as alternative to SignWell for enterprise clients.
 */

import type { FirmaProvider, FirmaRequest, FirmaResponse, FirmaEstado } from './interface';

export class DocusignProvider implements FirmaProvider {
  async enviarParaFirma(_request: FirmaRequest): Promise<FirmaResponse> {
    throw new Error(
      'DocuSign requiere configuracion enterprise. ' +
      'Configure FIRMA_PROVIDER=signwell para firma digital, ' +
      'o contacte soporte para activar DocuSign.'
    );
  }

  async obtenerEstado(_externalId: string): Promise<FirmaEstado> {
    throw new Error('DocuSign no configurado');
  }

  async descargarDocumentoFirmado(_externalId: string): Promise<Buffer> {
    throw new Error('DocuSign no configurado');
  }

  async cancelarFirma(_externalId: string): Promise<void> {
    throw new Error('DocuSign no configurado');
  }
}
