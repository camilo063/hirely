import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { pool } from '@/lib/db';
import { enviarInvitacionEntrevista } from '@/lib/services/email.service';

// POST /api/entrevistas/[id]/invitacion — Send interview invitation email
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    const body = await request.json();

    // Get interview details
    const result = await pool.query(
      `SELECT eh.*,
        c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
        v.titulo as vacante_titulo,
        u.name as entrevistador_nombre,
        o.name as org_nombre
       FROM entrevistas_humanas eh
       JOIN aplicaciones a ON a.id = eh.aplicacion_id
       JOIN candidatos c ON c.id = a.candidato_id
       JOIN vacantes v ON v.id = a.vacante_id
       JOIN organizations o ON o.id = v.organization_id
       JOIN users u ON u.id = eh.entrevistador_id
       WHERE eh.id = $1 AND v.organization_id = $2`,
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return apiError(new Error('Entrevista no encontrada'));
    }

    const entrevista = result.rows[0];
    const candidatoEmail = entrevista.candidato_email;

    if (!candidatoEmail) {
      return apiError(new Error('El candidato no tiene email registrado'));
    }

    // Update agendamiento_url if provided
    if (body.agendamiento_url) {
      await pool.query(
        `UPDATE entrevistas_humanas SET agendamiento_url = $1 WHERE id = $2`,
        [body.agendamiento_url, id]
      );
    }

    // Send email
    const candidatoNombre = `${entrevista.candidato_nombre} ${entrevista.candidato_apellido || ''}`.trim();
    await enviarInvitacionEntrevista(
      candidatoNombre,
      candidatoEmail,
      entrevista.vacante_titulo,
      entrevista.org_nombre,
      entrevista.entrevistador_nombre,
      body.agendamiento_url || entrevista.agendamiento_url
    );

    // Update email_invitacion_enviado flag and estado
    await pool.query(
      `UPDATE entrevistas_humanas SET
        email_invitacion_enviado = true,
        estado = CASE WHEN estado = 'pendiente' THEN 'agendada' ELSE estado END
       WHERE id = $1`,
      [id]
    );

    return apiResponse({ sent: true, email: candidatoEmail });
  } catch (error) {
    return apiError(error);
  }
}
