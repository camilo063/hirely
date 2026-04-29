import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { pool } from '@/lib/db';
import { resolveUrl } from '@/lib/integrations/s3';
import { apiResponse, apiError } from '@/lib/utils/api-response';

async function formatOrg(row: { name: string; logo_url: string | null; config_empresa: Record<string, string> | null }) {
  const logoUrl = row.logo_url || '';
  return {
    nombre_empresa: row.name,
    logo_url: logoUrl,
    logo_display_url: logoUrl ? await resolveUrl(logoUrl) : '',
    config: row.config_empresa || {},
  };
}

// GET /api/configuracion/empresa — obtener config empresa actual
export const maxDuration = 10;

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    const result = await pool.query(
      `SELECT name, logo_url, config_empresa FROM organizations WHERE id = $1`,
      [orgId]
    );

    if (result.rows.length === 0) {
      return apiResponse({ error: 'Organizacion no encontrada' }, 404);
    }

    return apiResponse(await formatOrg(result.rows[0]));
  } catch (error) {
    return apiError(error);
  }
}

// PATCH /api/configuracion/empresa — actualizar config empresa y/o nombre org
export async function PATCH(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const body = await request.json();

    // 1. Actualizar campos directos de la org
    const directFields: string[] = [];
    const directParams: unknown[] = [orgId];
    let idx = 2;

    if (body.nombre_empresa !== undefined) {
      directFields.push(`name = $${idx++}`);
      directParams.push(String(body.nombre_empresa).trim());
    }
    if (body.logo_url !== undefined) {
      directFields.push(`logo_url = $${idx++}`);
      directParams.push(String(body.logo_url).trim());
    }

    if (directFields.length > 0) {
      directFields.push('updated_at = NOW()');
      await pool.query(
        `UPDATE organizations SET ${directFields.join(', ')} WHERE id = $1`,
        directParams
      );
    }

    // 2. Actualizar config_empresa (campos del contratante)
    const camposPermitidos = [
      'nit', 'representante_legal', 'cargo_representante',
      'direccion', 'ciudad', 'departamento', 'pais',
      'telefono_empresa', 'email_empresa',
    ];

    const configLimpia: Record<string, string> = {};
    let hayConfig = false;
    for (const campo of camposPermitidos) {
      if (body[campo] !== undefined) {
        configLimpia[campo] = String(body[campo]).trim();
        hayConfig = true;
      }
    }

    if (hayConfig) {
      await pool.query(
        `UPDATE organizations
         SET config_empresa = COALESCE(config_empresa, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [orgId, JSON.stringify(configLimpia)]
      );
    }

    // 3. Retornar estado actualizado
    const result = await pool.query(
      `SELECT name, logo_url, config_empresa FROM organizations WHERE id = $1`,
      [orgId]
    );

    if (result.rows.length === 0) {
      return apiResponse({ error: 'Organizacion no encontrada' }, 404);
    }

    return apiResponse(await formatOrg(result.rows[0]));
  } catch (error) {
    return apiError(error);
  }
}
