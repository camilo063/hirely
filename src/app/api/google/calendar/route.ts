import { NextRequest } from 'next/server';
import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { getCalendarStatus } from '@/lib/services/calendario.service';
import { pool } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils/api-response';

// GET /api/google/calendar — estado de conexion
export const maxDuration = 30;

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const userId = await getUserId();

    const status = await getCalendarStatus(userId, orgId);
    return apiResponse(status);
  } catch (error) {
    return apiError(error);
  }
}

// DELETE /api/google/calendar — desconectar
export async function DELETE() {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const userId = await getUserId();

    await pool.query(
      `UPDATE google_tokens SET is_active = false, updated_at = NOW()
       WHERE user_id = $1 AND organization_id = $2`,
      [userId, orgId]
    );

    return apiResponse({ desconectado: true });
  } catch (error) {
    return apiError(error);
  }
}
