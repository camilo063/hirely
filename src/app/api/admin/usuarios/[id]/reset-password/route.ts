import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { requireAdmin, assertFilaDeOrg } from '@/lib/auth/authorization';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';
import { hashPassword, generarPasswordTemporal } from '@/lib/auth/password';
import { usuarioResetPasswordSchema } from '@/lib/validations/usuario.schema';

export const maxDuration = 10;

// POST /api/admin/usuarios/[id]/reset-password — fija una nueva contraseña.
// Si no se envia `password`, se genera una aleatoria. En ambos casos se
// devuelve en claro UNA sola vez para que el admin la muestre/copie.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    await requireAdmin();

    const { id } = await params;
    await assertFilaDeOrg('users', id, orgId);

    const body = await request.json().catch(() => ({}));
    const validated = usuarioResetPasswordSchema.parse(body);
    const password = validated.password ?? generarPasswordTemporal();

    const passwordHash = await hashPassword(password);
    await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3`,
      [passwordHash, id, orgId]
    );

    return apiResponse({ password });
  } catch (error) {
    return apiError(error);
  }
}
