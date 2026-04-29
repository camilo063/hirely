import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPortalData } from '@/lib/services/seleccion.service';
import { resolveUrl } from '@/lib/integrations/s3';

// GET /api/portal/documentos/[token] — Public portal data (no auth required)
export const maxDuration = 15;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const data = await getPortalData(token);

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Token invalido' },
        { status: 404 }
      );
    }

    if ('expired' in data && data.expired) {
      return NextResponse.json(
        { success: false, error: 'Token expirado', expired: true },
        { status: 410 }
      );
    }

    // Resolve s3:// URLs to presigned download URLs
    if ('documentos' in data && Array.isArray(data.documentos)) {
      const documentosResolved = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.documentos.map(async (doc: any) => ({
          ...doc,
          url: doc.url ? await resolveUrl(doc.url as string) : doc.url,
        }))
      );
      return NextResponse.json({ success: true, data: { ...data, documentos: documentosResolved } });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Portal] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}
