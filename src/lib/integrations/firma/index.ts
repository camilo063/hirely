/**
 * Firma Digital — Factory.
 *
 * Selecciona el provider activo via FIRMA_PROVIDER env var:
 * - 'signwell' → SignWell API (produccion, recomendado)
 * - 'docusign' → DocuSign (enterprise, placeholder)
 * - 'mock'     → Mock local (desarrollo)
 */

import type { FirmaProvider } from './interface';
import { SignwellProvider } from './signwell';
import { DocusignProvider } from './docusign';
import { MockFirmaProvider } from './mock';

export function crearFirmaProvider(): FirmaProvider {
  const provider = process.env.FIRMA_PROVIDER ?? 'mock';

  switch (provider) {
    case 'signwell':
      return new SignwellProvider();
    case 'docusign':
      return new DocusignProvider();
    case 'mock':
      return new MockFirmaProvider();
    default:
      console.warn(`[Firma] FIRMA_PROVIDER '${provider}' desconocido, usando mock`);
      return new MockFirmaProvider();
  }
}

export type { FirmaProvider, FirmaRequest, FirmaResponse, FirmaEstado, Signatario } from './interface';
