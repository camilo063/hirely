import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPortalData } from '@/lib/services/seleccion.service';

// GET /api/portal/documentos/[token] — Public portal data (no auth required)
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

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Portal] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}
