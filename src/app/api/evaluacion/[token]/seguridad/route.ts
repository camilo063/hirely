import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils/api-response';

/**
 * PUBLIC endpoint - no auth required.
 * Registers security events for an active evaluation.
 */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = await request.json();
    const { tipo, timestamp } = body;

    if (!tipo || !['cambio_pestana', 'intento_copia'].includes(tipo)) {
      return apiResponse({ error: 'Tipo de evento inválido' }, 400);
    }

    // Verify token exists and evaluation is in progress
    const evalResult = await pool.query(
      `SELECT id, estado FROM evaluaciones WHERE token_acceso = $1`,
      [params.token]
    );

    if (evalResult.rows.length === 0) {
      return apiResponse({ error: 'Token inválido' }, 404);
    }

    const evaluacion = evalResult.rows[0];
    if (!['enviada', 'en_progreso'].includes(evaluacion.estado)) {
      return apiResponse({ ok: true }); // silently ignore for completed evaluations
    }

    // Append event to JSONB array
    await pool.query(
      `UPDATE evaluaciones
       SET eventos_seguridad = COALESCE(eventos_seguridad, '[]'::jsonb) || $1::jsonb
       WHERE id = $2`,
      [
        JSON.stringify({ tipo, timestamp: timestamp || new Date().toISOString() }),
        evaluacion.id,
      ]
    );

    return apiResponse({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
