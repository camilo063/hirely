import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';
import { guardarEvaluacionHumana } from '@/lib/services/evaluacion-humana-campos.service';

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
    const orgId = await getOrgId();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const valores = (body?.valores ?? {}) as Record<string, number>;
    const observaciones: string | undefined = body?.observaciones;

    if (!valores || typeof valores !== 'object' || Object.keys(valores).length === 0) {
      return apiResponse({ error: 'Se requieren los valores de la evaluación' }, 422);
    }

    // 1. Guardar evaluacion + score_humano + recalcular score_final
    const { score_humano } = await guardarEvaluacionHumana(orgId, id, valores, observaciones);

    // 2. Transicionar a 'evaluado', acumulando el estado previo en estados_completados.
    //    Se construye el array en JS (evita el conflicto de tipos text[] vs varchar[]).
    const actual = await pool.query(
      `SELECT estado, estados_completados FROM aplicaciones WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );
    const row = actual.rows[0];
    if (row && row.estado !== 'evaluado') {
      const completados: string[] = row.estados_completados || [];
      if (row.estado && !completados.includes(row.estado)) completados.push(row.estado);
      await pool.query(
        `UPDATE aplicaciones
         SET estado = 'evaluado', estados_completados = $2, updated_at = NOW()
         WHERE id = $1 AND organization_id = $3`,
        [id, completados, orgId]
      );
    }

    return apiResponse({ success: true, score_humano });
  } catch (error) {
    return apiError(error);
  }
}
