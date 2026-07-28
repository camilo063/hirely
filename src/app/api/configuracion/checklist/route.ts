import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { getOrgChecklist, updateOrgChecklist } from '@/lib/services/seleccion.service';
import { requireAdmin } from '@/lib/auth/authorization';

// GET /api/configuracion/checklist — Get org document checklist
export const maxDuration = 10;

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const checklist = await getOrgChecklist(orgId);
    return apiResponse(checklist);
  } catch (error) {
    return apiError(error);
  }
}

// PUT /api/configuracion/checklist — Update org document checklist
export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    // Solo administradores: esta ruta cambia configuracion de toda la empresa.
    await requireAdmin();
    const orgId = await getOrgId();
    const body = await request.json();

    if (!Array.isArray(body.checklist)) {
      return apiResponse({ error: 'checklist debe ser un array' }, 422);
    }

    // Validacion de forma. Antes solo se comprobaba que fuera un array: un
    // elemento sin `tipo` (o con tipo null) se guardaba tal cual y luego TODA
    // seleccion de candidato de esa organizacion reventaba con un 500 al
    // insertar en documentos_candidato (columna `tipo` NOT NULL), sin forma
    // obvia de diagnosticarlo desde la interfaz.
    const vistos = new Set<string>();
    const checklist = [];

    for (const [i, item] of body.checklist.entries()) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return apiResponse({ error: `El documento #${i + 1} no es valido.` }, 422);
      }
      const tipo = typeof item.tipo === 'string' ? item.tipo.trim() : '';
      const label = typeof item.label === 'string' ? item.label.trim() : '';

      if (!tipo) {
        return apiResponse({ error: `El documento #${i + 1} no tiene identificador (tipo).` }, 422);
      }
      if (!label) {
        return apiResponse({ error: `El documento "${tipo}" no tiene nombre.` }, 422);
      }
      // Tipos repetidos rompen el conteo del portal: la lista se deduplica por
      // tipo pero los requisitos se cuentan por entrada, y el candidato ve
      // "faltan 2 documentos" sobre una lista de 1.
      if (vistos.has(tipo)) {
        return apiResponse({ error: `El documento "${tipo}" esta repetido.` }, 422);
      }
      vistos.add(tipo);

      checklist.push({
        tipo,
        label,
        requerido: item.requerido === true,
        descripcion: typeof item.descripcion === 'string' ? item.descripcion : undefined,
        aplica_para: Array.isArray(item.aplica_para)
          ? item.aplica_para.filter((t: unknown) => typeof t === 'string')
          : undefined,
      });
    }

    await updateOrgChecklist(orgId, checklist);
    return apiResponse({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
