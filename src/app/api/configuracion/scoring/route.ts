import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';
import { cached, invalidate, cacheKeys } from '@/lib/cache';

// Configuracion de scoring a nivel organizacion:
//  - peso_ia / peso_humano: ponderacion del score dual (entrevista IA vs evaluacion humana)
//  - umbral_preseleccion: corte ATS por defecto de la org (una vacante puede sobreescribirlo)
export const maxDuration = 10;

const DEFAULTS = { peso_ia: 40, peso_humano: 60, umbral_preseleccion: 70 };

// GET /api/configuracion/scoring
export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    const config = await cached(cacheKeys.scoringConfig(orgId), async () => {
      const result = await pool.query(
        `SELECT peso_ia, peso_humano, umbral_preseleccion
         FROM org_settings WHERE organization_id = $1`,
        [orgId]
      );

      const row = result.rows[0] || {};
      return {
        peso_ia: row.peso_ia != null ? Number(row.peso_ia) : DEFAULTS.peso_ia,
        peso_humano: row.peso_humano != null ? Number(row.peso_humano) : DEFAULTS.peso_humano,
        umbral_preseleccion:
          row.umbral_preseleccion != null ? Number(row.umbral_preseleccion) : DEFAULTS.umbral_preseleccion,
      };
    });

    return apiResponse(config);
  } catch (error) {
    return apiError(error);
  }
}

// PATCH /api/configuracion/scoring
export async function PATCH(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const body = await request.json();

    const allowedFields = ['peso_ia', 'peso_humano', 'umbral_preseleccion'] as const;

    // Validaciones basicas de rango
    for (const field of allowedFields) {
      if (field in body) {
        const n = Number(body[field]);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          return apiError(new Error(`${field} debe ser un numero entre 0 y 100`));
        }
      }
    }
    if ('peso_ia' in body && 'peso_humano' in body) {
      if (Number(body.peso_ia) + Number(body.peso_humano) !== 100) {
        return apiError(new Error('peso_ia + peso_humano deben sumar 100'));
      }
    }

    const providedFields = allowedFields.filter((f) => f in body);
    if (providedFields.length === 0) {
      return apiResponse({ success: true, message: 'No fields to update' });
    }

    const values: (number | string)[] = [orgId, ...providedFields.map((f) => Number(body[f]))];
    const insertCols = providedFields.join(', ');
    const insertPlaceholders = providedFields.map((_, i) => `$${i + 2}`).join(', ');
    const updateSet = providedFields.map((f, i) => `${f} = $${i + 2}`).join(', ');

    await pool.query(
      `INSERT INTO org_settings (organization_id, ${insertCols})
       VALUES ($1, ${insertPlaceholders})
       ON CONFLICT (organization_id) DO UPDATE SET
         ${updateSet},
         updated_at = NOW()`,
      values
    );

    await invalidate(cacheKeys.scoringConfig(orgId));
    return apiResponse({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
