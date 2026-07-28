import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import {
  getPipelineEstadosConfig,
  updatePipelineEstadosConfig,
} from '@/lib/services/pipeline-config.service';
import { requireAdmin } from '@/lib/auth/authorization';

// GET /api/configuracion/pipeline-estados — catalogo de estados de la org (merge)
export const maxDuration = 10;

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    return apiResponse({ estados: await getPipelineEstadosConfig(orgId) });
  } catch (error) {
    return apiError(error);
  }
}

// PUT /api/configuracion/pipeline-estados — guarda overrides (label/orden/activo)
export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    // Solo administradores: esta ruta cambia configuracion de toda la empresa.
    await requireAdmin();
    const orgId = await getOrgId();
    const body = await request.json();

    if (!Array.isArray(body.estados)) {
      return apiResponse({ error: 'estados debe ser un array' }, 422);
    }

    // El `orden` gobierna la maquina de estados completa: define que es avanzar
    // y que es retroceder. Sin validarlo, un orden negativo o repetido dejaba a
    // toda la organizacion sin poder contratar ("No se retrocede de X a
    // contratado") y corrompia el historial de etapas completadas, sin ninguna
    // señal en la interfaz.
    const ordenesVistos = new Set<number>();
    const estados = [];

    for (const [i, e] of body.estados.entries()) {
      if (!e || typeof e !== 'object' || typeof e.estado_key !== 'string') {
        return apiResponse({ error: `El estado #${i + 1} no es valido.` }, 422);
      }
      if (e.orden !== undefined && e.orden !== null) {
        const orden = Number(e.orden);
        // 99 esta reservado a `descartado`, que no forma parte de la linea
        // temporal del pipeline: el catalogo lo define asi y el formulario
        // reenvia todos los estados tal como los recibe.
        const maximo = e.estado_key === 'descartado' ? 99 : 98;
        if (!Number.isInteger(orden) || orden < 1 || orden > maximo) {
          return apiResponse(
            { error: `El orden de "${e.estado_key}" debe ser un entero entre 1 y ${maximo}.` },
            422
          );
        }
        if (ordenesVistos.has(orden)) {
          return apiResponse(
            { error: `El orden ${orden} esta repetido. Cada etapa necesita una posicion unica.` },
            422
          );
        }
        ordenesVistos.add(orden);
      }
      estados.push(e);
    }

    await updatePipelineEstadosConfig(orgId, estados);

    return apiResponse({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
