import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { z } from 'zod';

const registerSchema = z.object({
  orgName: z.string().min(2, 'Nombre de empresa requerido'),
  firstName: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
  email: z.string().email('Email invalido'),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = registerSchema.parse(body);

    // Check if email already exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [validated.email]
    );
    if (existing.rows.length > 0) {
      return apiResponse({ error: 'Este email ya esta registrado' }, 409);
    }

    // Create organization
    const slug = validated.orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const orgResult = await pool.query(
      `INSERT INTO organizations (name, slug, plan)
       VALUES ($1, $2, 'starter')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [validated.orgName, `${slug}-${Date.now().toString(36)}`]
    );
    const orgId = orgResult.rows[0].id;

    // Create user (in dev, store plain text hint; in production use bcrypt)
    const fullName = `${validated.firstName} ${validated.lastName}`;
    const passwordHash = `$dev$${validated.password}`; // Placeholder - use bcrypt in production

    const userResult = await pool.query(
      `INSERT INTO users (organization_id, email, name, role, password_hash, is_active)
       VALUES ($1, $2, $3, 'admin', $4, true)
       RETURNING id, email, name, role`,
      [orgId, validated.email, fullName, passwordHash]
    );

    return apiResponse({
      user: userResult.rows[0],
      message: 'Cuenta creada exitosamente',
    }, 201);
  } catch (error) {
    return apiError(error);
  }
}
