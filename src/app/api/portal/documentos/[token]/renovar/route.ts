import { NextRequest, NextResponse } from 'next/server';
import { renovarTokenPortal } from '@/lib/services/portal-documentos.service';
import { rateLimit } from '@/lib/utils/rate-limit';

/**
 * POST /api/portal/documentos/[token]/renovar
 *
 * El candidato llego con un link vencido y pide uno nuevo. Publico (sin auth):
 * el propio token es la credencial. El link nuevo NO se devuelve aqui — se envia
 * al correo registrado del candidato, para que tener un link viejo no alcance
 * si quien lo tiene no controla ese buzon.
 *
 * Antes de esto, un link vencido era un callejon sin salida: el candidato solo
 * veia "contacta a recursos humanos" y el proceso se detenia ahi.
 */
export const maxDuration = 15;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Freno que no depende del estado en BD: cuando el envio falla el token se
    // descarta, asi que sin esto un proveedor de correo caido permitiria
    // reintentos sin tope desde un endpoint publico.
    const rl = await rateLimit({
      clave: `renovar:${token}`,
      limite: 5,
      ventanaSegundos: 3600,
    });
    if (!rl.permitido) {
      return NextResponse.json(
        { success: false, error: 'Demasiados intentos. Espera unos minutos o contacta al equipo.' },
        { status: 429, headers: { 'Retry-After': String(rl.reintentarEn) } }
      );
    }

    const resultado = await renovarTokenPortal(token);

    return NextResponse.json(
      {
        success: resultado.ok,
        data: resultado.ok
          ? { mensaje: resultado.mensaje, email_destino: resultado.emailDestino }
          : undefined,
        error: resultado.ok ? undefined : resultado.mensaje,
      },
      { status: resultado.ok ? 200 : 400 }
    );
  } catch (error) {
    console.error('[Portal Renovar] Error:', error);
    return NextResponse.json(
      { success: false, error: 'No pudimos generar un link nuevo. Intenta mas tarde.' },
      { status: 500 }
    );
  }
}
