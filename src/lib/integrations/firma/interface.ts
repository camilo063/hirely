/**
 * Firma Digital — Interface comun para cualquier proveedor de firma electronica.
 *
 * Implementaciones: SignWell (produccion), DocuSign (enterprise), Mock (dev)
 * El provider se selecciona via FIRMA_PROVIDER en .env
 */

export interface Signatario {
  nombre: string;
  email: string;
  orden?: number;
  rol?: string; // 'candidato' | 'empresa' | 'testigo'
}

export interface FirmaRequest {
  contratoId: string;
  titulo: string;
  htmlContenido: string;
  signatarios: Signatario[];
  webhookUrl?: string;
  expiresInDays?: number;
  mensaje?: string;
}

export interface FirmaResponse {
  externalId: string;
  signingUrl?: string;
  status: 'pending' | 'sent' | 'completed' | 'declined' | 'expired';
}

export interface FirmaEstado {
  externalId: string;
  status: 'pending' | 'sent' | 'completed' | 'declined' | 'expired';
  signatarios: {
    email: string;
    nombre: string;
    firmado: boolean;
    firmado_at?: string;
  }[];
  completado_at?: string;
}

export interface FirmaProvider {
  enviarParaFirma(request: FirmaRequest): Promise<FirmaResponse>;
  obtenerEstado(externalId: string): Promise<FirmaEstado>;
  descargarDocumentoFirmado(externalId: string): Promise<Buffer>;
  cancelarFirma(externalId: string): Promise<void>;
}
