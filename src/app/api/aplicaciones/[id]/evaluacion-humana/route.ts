import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';
import { guardarEvaluacionHumana } from '@/lib/services/evaluacion-humana-campos.service';
import { transicionarEstado } from '@/lib/services/pipeline-transicion.service';
import { requireEscritura } from '@/lib/auth/authorization';

export const maxDuration = 15;

// POST /api/aplicaciones/[id]/evaluacion-humana
// Body: { valores: Record<string, number>, observaciones?: string }
// Guarda la evaluacion humana, calcula score_humano, recalcula score_final
// y transiciona la aplicacion al estado 'evaluado'.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    // Escritura del pipeline: un rol de solo lectura no debe mutar datos.
    await requireEscritura();
    const orgId = await getOrgId();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const valores = (body?.valores ?? {}) as Record<string, number>;
    const observaciones: string | undefined = body?.observaciones;

    if (!valores || typeof valores !== 'object' || Object.keys(valores).length === 0) {
      return apiResponse({ error: 'Se requieren los valores de la evaluación' }, 422);
    }

    // 1. Verificar pertenencia ANTES de escribir nada.
    //    `guardarEvaluacionHumana` filtra por organizacion pero no falla cuando
    //    su UPDATE afecta 0 filas, asi que sin este chequeo la peticion seguia
    //    su curso con el id de otra empresa.
    const pertenece = await pool.query(
      `SELECT 1 FROM aplicaciones a
       JOIN vacantes v ON v.id = a.vacante_id
       WHERE a.id = $1 AND v.organization_id = $2`,
      [id, orgId]
    );
    if (pertenece.rowCount === 0) {
      return apiResponse({ error: 'Aplicacion no encontrada' }, 404);
    }

    // 2. Guardar evaluacion + score_humano + recalcular score_final
    const { score_humano } = await guardarEvaluacionHumana(orgId, id, valores, observaciones);

    // 3. Transicionar a 'evaluado' por la via central.
    //    El calculo a mano que habia aqui no hacia backfill del historial y, sobre
    //    todo, no tenia guard de retroceso: registrar la evaluacion humana de un
    //    candidato que ya estaba 'seleccionado' lo devolvia a 'evaluado'.
    await transicionarEstado(id, 'evaluado', { orgId });

    return apiResponse({ success: true, score_humano });
  } catch (error) {
    return apiError(error);
  }
}
