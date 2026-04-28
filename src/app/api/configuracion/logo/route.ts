import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { saveFile, FileValidationError, deleteFile } from '@/lib/utils/file-storage';
import { resolveUrl } from '@/lib/integrations/s3';
import { pool } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils/api-response';

const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || !(file instanceof File)) {
      return apiResponse({ error: 'Archivo requerido (campo: file)' }, 400);
    }
    if (file.type && !ALLOWED_LOGO_TYPES.includes(file.type)) {
      return apiResponse({ error: 'Solo se permiten imágenes JPG o PNG' }, 400);
    }

    const previous = await pool.query(
      'SELECT logo_url FROM organizations WHERE id = $1',
      [orgId]
    );
    const previousUrl: string | null = previous.rows[0]?.logo_url || null;

    const saved = await saveFile(file, orgId, 'logo', orgId, 'organizacion');

    await pool.query(
      'UPDATE organizations SET logo_url = $1, updated_at = NOW() WHERE id = $2',
      [saved.url, orgId]
    );

    if (previousUrl && previousUrl !== saved.url && previousUrl.startsWith('s3://')) {
      try {
        await deleteFile(previousUrl);
      } catch {
        // Non-critical: orphan files are acceptable
      }
    }

    const displayUrl = await resolveUrl(saved.url);

    return apiResponse({
      url: saved.url,
      displayUrl,
      size: saved.size,
    });
  } catch (error) {
    if (error instanceof FileValidationError) {
      return apiResponse({ error: error.message }, 400);
    }
    return apiError(error);
  }
}
