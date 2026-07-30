import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { requireAdmin } from '@/lib/auth/authorization';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { usuarioCreateSchema } from '@/lib/validations/usuario.schema';
import { ConflictError } from '@/lib/utils/errors';

export const maxDuration = 10;

// GET /api/admin/usuarios — lista completa (activos e inactivos) de la organizacion.
// Solo admin: a diferencia de GET /api/users (dropdowns, solo activos), esta es
// la fuente para el panel de gestion.
export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    await requireAdmin();

    const result = await pool.query(
      `SELECT id, name, email, role, is_active, created_at
       FROM users
       WHERE organization_id = $1
       ORDER BY name ASC`,
      [orgId]
    );

    return apiResponse(result.rows);
  } catch (error) {
    return apiError(error);
  }
}

// POST /api/admin/usuarios — crea un usuario en la organizacion del admin actual.
// La contraseña se devuelve en claro UNA sola vez en la respuesta (nunca se
// persiste ni se loguea) para que la UI la muestre al admin.
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    await requireAdmin();

    const body = await request.json();
    const validated = usuarioCreateSchema.parse(body);

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [validated.email]);
    if (existing.rows.length > 0) {
      throw new ConflictError('Este email ya esta registrado');
    }

    const passwordHash = await hashPassword(validated.password);
    const result = await pool.query(
      `INSERT INTO users (organization_id, email, name, role, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, name, role, is_active, created_at`,
      [orgId, validated.email, validated.name, validated.role, passwordHash]
    );

    return apiResponse({ user: result.rows[0], password: validated.password }, 201);
  } catch (error) {
    return apiError(error);
  }
}
