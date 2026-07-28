import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { extractS3Key, getSignedDownloadUrl, getPresignedUploadUrl } from '@/lib/integrations/s3';
import { requireEscritura } from '@/lib/auth/authorization';
import { apiError } from '@/lib/utils/api-response';

const ALLOWED_UPLOAD_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// POST /api/s3/presign
// Body: { key: string, action: 'download' | 'upload', contentType?: string, expiresIn?: number }
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    // Escritura: un rol de solo lectura no debe mutar datos.
    await requireEscritura();
    const orgId = await getOrgId();

    const body = await req.json();
    const { key, action = 'download', contentType, expiresIn } = body;

    if (!key) {
      return NextResponse.json({ error: 'key es requerido' }, { status: 400 });
    }

    // Validate: key must belong to user's organization.
    //
    // El guard anterior era `if (orgId && ...)`: como `getOrgId()` devuelve ''
    // cuando la sesion no trae organizacion, el `&&` cortocircuitaba y la
    // comprobacion NO se ejecutaba — se firmaba cualquier objeto del bucket
    // (CVs, cedulas y contratos de todas las empresas). Ahora falla cerrado.
    //
    // Ademas se compara el primer segmento completo, no un prefijo: `startsWith`
    // a secas aceptaba `{orgId}-EXTRA/...`, y una key con `..` pasaba el filtro.
    const cleanKey = extractS3Key(key);
    const primerSegmento = cleanKey.split('/')[0];

    if (!orgId || primerSegmento !== orgId || cleanKey.includes('..')) {
      console.warn(`[S3 Presign] Intento cross-tenant: user org=${orgId || '(sin org)'}, key=${cleanKey}`);
      return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
    }

    let url: string;

    if (action === 'upload') {
      if (!contentType) {
        return NextResponse.json({ error: 'contentType requerido para upload' }, { status: 400 });
      }
      if (!ALLOWED_UPLOAD_TYPES.includes(contentType)) {
        return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
      }
      url = await getPresignedUploadUrl(cleanKey, contentType, expiresIn || 900);
    } else {
      url = await getSignedDownloadUrl(cleanKey, expiresIn || 3600);
    }

    return NextResponse.json({
      url,
      key: cleanKey,
      expiresIn: expiresIn || (action === 'upload' ? 900 : 3600),
    });
  } catch (error: unknown) {
    // El detalle se registra en el servidor, no se devuelve al cliente: antes
    // viajaba en la respuesta y filtraba mensajes internos (incluido un literal
    // "No autorizado" dentro de un 500).
    console.error('[S3 Presign] Error:', error);
    // Los errores de autorizacion tienen que salir como 401/403: el catch
    // generico los convertia en 500 y hasta un admin veia "Error generando URL"
    // cuando el problema real era otro.
    return apiError(error);
  }
}
