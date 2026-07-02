import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { resolveUrl } from '@/lib/integrations/s3';

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

  // Tolera URLs absolutas (S3/enlaces) y relativas (uploads locales en dev).
  return NextResponse.redirect(new URL(target, _req.url));
}
