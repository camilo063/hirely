import { NextRequest } from 'next/server';
import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { verificarDocumento, getChecklistDocumentos } from '@/lib/services/seleccion.service';
import { resolveUrl } from '@/lib/integrations/s3';

// PATCH /api/documentos/[id] — Verificar o rechazar documento
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const userId = await getUserId();
    const { id } = await params;
    const body = await request.json();

    if (!body.accion || !['verificar', 'rechazar'].includes(body.accion)) {
      return apiError(new Error('accion debe ser "verificar" o "rechazar"'));
    }

    if (body.accion === 'rechazar' && !body.nota_rechazo) {
      return apiError(new Error('nota_rechazo es requerida al rechazar'));
    }

    await verificarDocumento(id, orgId, userId, body.accion, body.nota_rechazo);
    return apiResponse({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

// GET /api/documentos/[id] — Get checklist for an aplicacion
// Here [id] is the aplicacion_id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;

    const result = await getChecklistDocumentos(id, orgId);

    // Resolve s3:// URLs to presigned download URLs
    const documentosResolved = await Promise.all(
      result.documentos.map(async (doc) => ({
        ...doc,
        url: doc.url ? await resolveUrl(doc.url) : doc.url,
      }))
    );

    return apiResponse({ ...result, documentos: documentosResolved });
  } catch (error) {
    return apiError(error);
  }
}
