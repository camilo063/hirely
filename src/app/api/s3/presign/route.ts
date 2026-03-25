import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { extractS3Key, getSignedDownloadUrl, getPresignedUploadUrl } from '@/lib/integrations/s3';

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
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    const body = await req.json();
    const { key, action = 'download', contentType, expiresIn } = body;

    if (!key) {
      return NextResponse.json({ error: 'key es requerido' }, { status: 400 });
    }

    // Validate: key must belong to user's organization
    const cleanKey = extractS3Key(key);

    if (orgId && !cleanKey.startsWith(orgId)) {
      console.warn(`[S3 Presign] Intento cross-tenant: user org=${orgId}, key=${cleanKey}`);
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
    console.error('[S3 Presign] Error:', error);
    const message = error instanceof Error ? error.message : 'Error generando URL';
    return NextResponse.json({ error: 'Error generando URL', detail: message }, { status: 500 });
  }
}
