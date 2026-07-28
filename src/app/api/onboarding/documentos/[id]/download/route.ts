import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { resolveUrl } from '@/lib/integrations/s3';
import { rateLimit, ipDeRequest, respuesta429 } from '@/lib/utils/rate-limit';

// GET — Endpoint público de descarga estable de documentos de onboarding.
// El candidato lo abre desde su email sin sesión; la seguridad se basa en que
// el id es un UUID no adivinable (mismo criterio que los tokens de portal).
// Redirige (302) a una URL firmada fresca cuando el documento vive en S3.
export const maxDuration = 10;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // El identificador funciona como credencial permanente (viaja en correos e
  // historiales). El freno limita la exploracion y el abuso de ancho de banda.
  const rl = await rateLimit({ clave: `docOnb:${ipDeRequest(_req)}`, limite: 30, ventanaSegundos: 300 });
  if (!rl.permitido) return respuesta429(rl.reintentarEn) as unknown as NextResponse;

  const result = await pool.query(
    `SELECT url FROM documentos_onboarding WHERE id = $1 AND is_active = true`,
    [id]
  );

  const doc = result.rows[0];
  if (!doc || !doc.url) {
    return new NextResponse('Documento no encontrado', { status: 404 });
  }

  // s3:// refs se resuelven a una URL firmada temporal fresca; http(s) se usan directo.
  const target = doc.url.startsWith('s3://') ? await resolveUrl(doc.url) : doc.url;

  // Redireccion validada.
  //
  // `url` es una columna que un administrador puede rellenar con cualquier cosa,
  // y esta ruta es publica: sin validar el destino, la aplicacion se convertia en
  // un redirector abierto alojado en su propio dominio (util para phishing, ya
  // que el enlace inicial pertenece al dominio de confianza).
  let destino: URL;
  try {
    destino = new URL(target, _req.url);
  } catch {
    return new NextResponse('Documento no disponible', { status: 404 });
  }

  const propio = new URL(_req.url);
  const esRelativa = destino.origin === propio.origin;
  const esAlmacenamiento = /(^|\.)((s3[.-][a-z0-9-]+)?\.amazonaws\.com|r2\.cloudflarestorage\.com|blob\.vercel-storage\.com)$/i.test(destino.hostname);

  if (!esRelativa && !esAlmacenamiento) {
    console.warn('[Onboarding Download] Destino no permitido:', destino.hostname);
    return new NextResponse('Documento no disponible', { status: 404 });
  }

  return NextResponse.redirect(destino);
}
