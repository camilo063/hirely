import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';
import { addDocumentoOnboarding } from '@/lib/services/onboarding.service';
import { saveFile, validateFile } from '@/lib/utils/file-storage';

// GET — Listar documentos de onboarding de la org
export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    const result = await pool.query(
      `SELECT id, nombre, descripcion, url, tipo, orden, created_at
       FROM documentos_onboarding
       WHERE organization_id = $1 AND is_active = true
       ORDER BY orden, created_at`,
      [orgId]
    );

    return apiResponse(result.rows);
  } catch (error) {
    return apiError(error);
  }
}

// POST — Subir nuevo documento de onboarding
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const nombre = formData.get('nombre') as string;
      const descripcion = formData.get('descripcion') as string | null;
      const tipo = (formData.get('tipo') as string) || 'pdf';

      if (!file || !nombre) {
        return apiError(new Error('file y nombre son requeridos'));
      }

      validateFile(file);
      const { url } = await saveFile(file, orgId, `onboarding-${Date.now()}`, orgId, 'onboarding');

      const docId = await addDocumentoOnboarding(orgId, {
        nombre,
        url,
        tipo,
        descripcion: descripcion || undefined,
      });

      return apiResponse({ id: docId, nombre, url, tipo }, 201);
    } else {
      // JSON body (for link type)
      const body = await request.json();
      if (!body.nombre || !body.url) {
        return apiError(new Error('nombre y url son requeridos'));
      }

      const docId = await addDocumentoOnboarding(orgId, {
        nombre: body.nombre,
        url: body.url,
        tipo: body.tipo || 'link',
        descripcion: body.descripcion,
      });

      return apiResponse({ id: docId, ...body }, 201);
    }
  } catch (error) {
    return apiError(error);
  }
}
