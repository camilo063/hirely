import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { reenviarEnlacePortal } from '@/lib/services/portal-documentos.service';
import { requireEscritura } from '@/lib/auth/authorization';

// POST /api/documentos/[id]/reenviar — Reenvia el link del portal de
// documentos a peticion del reclutador. Aqui [id] es el aplicacion_id, igual
// que en el GET del padre.
export const maxDuration = 15;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    // Escritura del pipeline: un rol de solo lectura no debe disparar correos.
    await requireEscritura();
    const orgId = await getOrgId();
    const { id } = await params;

    const resultado = await reenviarEnlacePortal(id, orgId);
    if (!resultado.enviado) {
      return apiResponse({ error: resultado.error || 'No se pudo enviar el correo' }, 502);
    }
    return apiResponse({ enviado: true });
  } catch (error) {
    return apiError(error);
  }
}
