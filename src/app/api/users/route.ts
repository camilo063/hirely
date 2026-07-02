import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';

export const maxDuration = 10;

// GET /api/users?role=admin,recruiter
// Lista los usuarios activos de la organizacion (para selects de lider/entrevistador).
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role');
    const roles = roleParam
      ? roleParam.split(',').map((r) => r.trim()).filter(Boolean)
      : null;

    const params: unknown[] = [orgId];
    let where = 'organization_id = $1 AND is_active = true';
    if (roles && roles.length > 0) {
      where += ` AND role = ANY($2)`;
      params.push(roles);
    }

    const result = await pool.query(
      `SELECT id, name, email, role
       FROM users
       WHERE ${where}
       ORDER BY name ASC`,
      params
    );

    return apiResponse(result.rows);
  } catch (error) {
    return apiError(error);
  }
}
