import { NextRequest } from 'next/server';
import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { requireAdmin, assertFilaDeOrg } from '@/lib/auth/authorization';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';
import { usuarioUpdateSchema } from '@/lib/validations/usuario.schema';
import { NotFoundError, ValidationError } from '@/lib/utils/errors';

export const maxDuration = 10;

// PATCH /api/admin/usuarios/[id] — edita nombre/rol/estado.
//
// Salvaguarda anti-bloqueo: un admin no puede desactivarse ni quitarse el rol
// admin a si mismo, ni dejar a la organizacion sin ningun admin activo. Nace
// del incidente donde 3 cuentas quedaron bloqueadas y solo se pudo arreglar
// con acceso directo a la base de datos de produccion.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    await requireAdmin();
    const actingUserId = await getUserId();

    const { id } = await params;
    await assertFilaDeOrg('users', id, orgId);

    const body = await request.json();
    const validated = usuarioUpdateSchema.parse(body);

    const campos: string[] = [];
    const valores: unknown[] = [];
    if (validated.name !== undefined) {
      valores.push(validated.name);
      campos.push(`name = $${valores.length}`);
    }
    if (validated.role !== undefined) {
      valores.push(validated.role);
      campos.push(`role = $${valores.length}`);
    }
    if (validated.is_active !== undefined) {
      valores.push(validated.is_active);
      campos.push(`is_active = $${valores.length}`);
    }

    if (campos.length === 0) {
      throw new ValidationError('Nada para actualizar');
    }

    campos.push('updated_at = NOW()');
    valores.push(id);
    const idPos = valores.length;
    valores.push(orgId);
    const orgPos = valores.length;

    // Verificacion + actualizacion en una sola transaccion: el `SELECT ... FOR
    // UPDATE` bloquea la fila del usuario objetivo, asi que dos PATCH
    // concurrentes sobre DOS admins distintos de la misma organizacion ya no
    // pueden leer el mismo conteo antes de que el primero confirme. Sin esto,
    // ambos podrian pasar la validacion "queda al menos un admin" y dejar la
    // organizacion sin ninguno — justo el escenario que esta salvaguarda existe
    // para evitar.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT role, is_active FROM users WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [id, orgId]
      );
      if (rows.length === 0) throw new NotFoundError('Usuario', id);
      const actual = rows[0] as { role: string; is_active: boolean };

      const seDesactiva = validated.is_active === false && actual.is_active;
      const seDegradaDeAdmin =
        validated.role !== undefined && validated.role !== 'admin' && actual.role === 'admin';

      if (seDesactiva || seDegradaDeAdmin) {
        if (id === actingUserId) {
          throw new ValidationError(
            seDesactiva
              ? 'No puedes desactivar tu propia cuenta.'
              : 'No puedes quitarte a ti mismo el rol de administrador.'
          );
        }
        if (actual.role === 'admin') {
          // `FOR UPDATE` no admite funciones de agregacion (COUNT): se bloquean
          // las filas individuales y se cuenta en JS, para que un segundo PATCH
          // concurrente sobre OTRO admin de la misma organizacion espere a que
          // esta transaccion termine antes de leer el mismo conjunto de filas.
          const { rows: admins } = await client.query(
            `SELECT id FROM users
             WHERE organization_id = $1 AND role = 'admin' AND is_active = true
             FOR UPDATE`,
            [orgId]
          );
          if (admins.length <= 1) {
            throw new ValidationError(
              'Esta organizacion se quedaria sin ningun administrador activo. Asigna el rol admin a otro usuario antes de continuar.'
            );
          }
        }
      }

      const result = await client.query(
        `UPDATE users SET ${campos.join(', ')}
         WHERE id = $${idPos} AND organization_id = $${orgPos}
         RETURNING id, email, name, role, is_active, created_at`,
        valores
      );

      await client.query('COMMIT');
      return apiResponse(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
