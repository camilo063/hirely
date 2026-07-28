/**
 * Verificacion de firma de webhooks entrantes.
 *
 * PROBLEMA QUE RESUELVE
 * Los webhooks de firma electronica (SignWell y DocuSign) no validaban NADA: ni
 * firma, ni secreto, ni cabecera. Localizaban el contrato por el
 * `firma_external_id` que venia en el cuerpo y, con el, marcaban el contrato como
 * firmado, enviaban correos reales al candidato y a los administradores, y
 * pasaban la aplicacion a 'contratado'. Un POST anonimo podia falsificar la firma
 * de un contrato laboral en cualquier organizacion.
 *
 * Los webhooks de Dapta y Unipile si validaban; estos dos se habian quedado
 * fuera del patron.
 */

import crypto from 'crypto';

export interface ResultadoVerificacion {
  valido: boolean;
  motivo?: string;
}

/**
 * Compara dos firmas en tiempo constante.
 * `timingSafeEqual` exige buffers del mismo tamaño, de ahi el chequeo previo.
 */
function firmasIguales(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifica la firma HMAC-SHA256 de un webhook.
 *
 * @param rawBody  Cuerpo CRUDO de la peticion. Debe ser exactamente el texto
 *                 recibido: si se re-serializa el JSON, la firma no cuadra.
 * @param firma    Valor de la cabecera de firma (acepta el prefijo "sha256=").
 * @param secreto  Secreto compartido configurado en el proveedor.
 */
export function verificarFirmaHmac(
  rawBody: string,
  firma: string | null,
  secreto: string | undefined
): ResultadoVerificacion {
  if (!secreto) {
    // Sin secreto configurado no se puede verificar. En produccion se rechaza:
    // es preferible que la firma de contratos deje de avanzar a que cualquiera
    // pueda falsificarla. En desarrollo se deja pasar para no bloquear pruebas
    // locales, y se avisa por consola.
    if (process.env.NODE_ENV === 'production') {
      return { valido: false, motivo: 'Webhook sin secreto configurado en el servidor' };
    }
    console.warn('[Webhook] Sin secreto configurado — se acepta por ser entorno de desarrollo');
    return { valido: true };
  }

  if (!firma) return { valido: false, motivo: 'Falta la cabecera de firma' };

  const esperada = crypto.createHmac('sha256', secreto).update(rawBody, 'utf8').digest('hex');
  const recibida = firma.replace(/^sha256=/i, '').trim().toLowerCase();

  return firmasIguales(esperada, recibida)
    ? { valido: true }
    : { valido: false, motivo: 'Firma invalida' };
}

/**
 * Cabeceras de firma que usa cada proveedor. Se prueban en orden y se toma la
 * primera presente, para tolerar variaciones entre versiones de sus APIs.
 */
const CABECERAS_FIRMA = [
  'x-signwell-signature',
  'x-signwell-webhook-signature',
  'x-docusign-signature-1',
  'x-webhook-signature',
  'x-hub-signature-256',
];

export function extraerFirma(headers: Headers): string | null {
  for (const nombre of CABECERAS_FIRMA) {
    const valor = headers.get(nombre);
    if (valor) return valor;
  }
  return null;
}
