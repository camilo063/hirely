import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';
import { cached, invalidate, cacheKeys } from '@/lib/cache';

// GET /api/configuracion/emails — Get email templates + firma admin email
export const maxDuration = 10;

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    const config = await cached(cacheKeys.emailsConfig(orgId), async () => {
      const result = await pool.query(
        `SELECT email_seleccion_body, email_rechazo_body, email_onboarding_body, email_firma_admin
         FROM org_settings WHERE organization_id = $1`,
        [orgId]
      );

      const row = result.rows[0];
      return {
        email_seleccion_body: row?.email_seleccion_body || '',
        email_rechazo_body: row?.email_rechazo_body || '',
        email_onboarding_body: row?.email_onboarding_body || '',
        email_firma_admin: row?.email_firma_admin || '',
      };
    });

    return apiResponse(config);
  } catch (error) {
    return apiError(error);
  }
}

// PATCH /api/configuracion/emails — Update email templates + firma admin email
export async function PATCH(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const body = await request.json();

    // Build dynamic SET clause for only provided fields
    const allowedFields = [
      'email_seleccion_body',
      'email_rechazo_body',
      'email_onboarding_body',
      'email_firma_admin',
    ];

    const updates: string[] = [];
    const values: (string | null)[] = [orgId];
    let paramIdx = 2;

    for (const field of allowedFields) {
      if (field in body) {
        updates.push(`${field} = $${paramIdx}`);
        values.push(body[field] ?? null);
        paramIdx++;
      }
    }

    if (updates.length === 0) {
      return apiResponse({ success: true, message: 'No fields to update' });
    }

    await pool.query(
      `INSERT INTO org_settings (organization_id, ${allowedFields.filter(f => f in body).join(', ')})
       VALUES ($1, ${allowedFields.filter(f => f in body).map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (organization_id) DO UPDATE SET
         ${updates.join(', ')},
         updated_at = NOW()`,
      values
    );

    await invalidate(cacheKeys.emailsConfig(orgId));
    return apiResponse({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
