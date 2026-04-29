import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { saveFile, FileValidationError } from '@/lib/utils/file-storage';
import { apiResponse, apiError } from '@/lib/utils/api-response';

/**
 * POST /api/upload — General-purpose file upload endpoint
 *
 * Accepts multipart/form-data with:
 *   - file: the file to upload (required)
 *   - entity_id: the entity the file belongs to (required)
 *   - tipo: file type label, e.g. "cv", "cedula" (required)
 *   - entity: entity type for path, e.g. "documentos", "contratos" (default: "documentos")
 *
 * Returns: { key, url, size }
 */
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const entityId = formData.get('entity_id') as string | null;
    const tipo = formData.get('tipo') as string | null;
    const entity = (formData.get('entity') as string) || 'documentos';

    if (!file || !(file instanceof File)) {
      return apiResponse({ error: 'Archivo requerido (campo: file)' }, 400);
    }
    if (!entityId) {
      return apiResponse({ error: 'entity_id requerido' }, 400);
    }
    if (!tipo) {
      return apiResponse({ error: 'tipo requerido' }, 400);
    }

    const result = await saveFile(file, entityId, tipo, orgId, entity);

    return apiResponse({
      url: result.url,
      key: result.key || null,
      size: result.size,
      filename: `${tipo}${file.name.substring(file.name.lastIndexOf('.'))}`,
    });
  } catch (error) {
    if (error instanceof FileValidationError) {
      return apiResponse({ error: error.message }, 400);
    }
    return apiError(error);
  }
}
