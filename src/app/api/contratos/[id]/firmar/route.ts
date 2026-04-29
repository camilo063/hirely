import { NextRequest } from 'next/server';
import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { pool } from '@/lib/db';
import { enviarParaFirma } from '@/lib/services/firma-electronica.service';
import { enviarEmail } from '@/lib/services/email.service';
import { emailOnboardingTemplate } from '@/lib/utils/email-templates';
import { apiResponse, apiError } from '@/lib/utils/api-response';

// POST — Enviar contrato para firma electronica
export const maxDuration = 30;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;

    const result = await enviarParaFirma(orgId, id);

    if (!result.success) {
      return apiResponse({ success: false, error: result.error }, 400);
    }

    return apiResponse({ message: 'Contrato enviado para firma', signingUrl: result.signingUrl });
  } catch (error) {
    return apiError(error);
  }
}

// PATCH — Confirmar firma bilateral (ambas partes han firmado)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const userId = await getUserId();
    const { id: contratoId } = await params;
    const body = await request.json();

    const fechaFirma = body.fechaFirma || new Date().toISOString();
    const notas = body.notas || null;

    // 1. Verificar que el contrato existe y esta en estado enviable
    const contratoResult = await pool.query(
      `SELECT ct.*, ct.aplicacion_id, ct.organization_id,
              c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
              v.titulo as vacante_titulo,
              o.name as org_nombre
       FROM contratos ct
       LEFT JOIN candidatos c ON ct.candidato_id = c.id
       LEFT JOIN vacantes v ON ct.vacante_id = v.id
       LEFT JOIN organizations o ON ct.organization_id = o.id
       WHERE ct.id = $1 AND ct.organization_id = $2`,
      [contratoId, orgId]
    );

    if (contratoResult.rows.length === 0) {
      return apiResponse({ error: 'Contrato no encontrado' }, 404);
    }

    const contrato = contratoResult.rows[0];

    if (contrato.estado === 'firmado') {
      return apiResponse({ error: 'Este contrato ya esta firmado' }, 422);
    }

    // 2. Actualizar contrato a firmado
    await pool.query(
      `UPDATE contratos
       SET estado = 'firmado',
           firmado_at = $2,
           datos_contrato = COALESCE(datos_contrato, '{}'::jsonb) || $3::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [
        contratoId,
        fechaFirma,
        JSON.stringify({ notas_firma: notas, firmado_por: userId }),
      ]
    );

    // 3. Activity log
    try {
      await pool.query(
        `INSERT INTO activity_log (organization_id, user_id, entidad, entidad_id, accion, detalles)
         VALUES ($1, $2, 'contrato', $3, 'contrato_firmado', $4)`,
        [
          orgId, userId, contratoId,
          JSON.stringify({
            fecha_firma: fechaFirma,
            notas,
            candidato: `${contrato.candidato_nombre} ${contrato.candidato_apellido || ''}`.trim(),
            vacante: contrato.vacante_titulo,
          }),
        ]
      );
    } catch { /* non-blocking */ }

    // 4. Disparar email de onboarding al candidato
    let onboardingEnviado = false;
    try {
      if (contrato.candidato_email) {
        const candidatoNombre = `${contrato.candidato_nombre} ${contrato.candidato_apellido || ''}`.trim();
        const emailData = emailOnboardingTemplate({
          candidatoNombre,
          vacanteTitulo: contrato.vacante_titulo,
          empresaNombre: contrato.org_nombre,
        });

        await enviarEmail({
          to: contrato.candidato_email,
          subject: emailData.subject,
          html: emailData.htmlBody,
        });
        onboardingEnviado = true;
        console.log('[FIRMA] Email onboarding enviado a:', contrato.candidato_email);
      }
    } catch (emailError) {
      console.error('[FIRMA] Error enviando email de onboarding:', emailError);
    }

    // 5. Crear registro de onboarding si no existe
    try {
      const existente = await pool.query(
        `SELECT id FROM onboarding WHERE aplicacion_id = $1 LIMIT 1`,
        [contrato.aplicacion_id]
      );
      if (existente.rows.length === 0 && contrato.aplicacion_id) {
        const candidatoResult = await pool.query(
          `SELECT candidato_id FROM aplicaciones WHERE id = $1`,
          [contrato.aplicacion_id]
        );
        const candidatoId = candidatoResult.rows[0]?.candidato_id;
        if (candidatoId) {
          await pool.query(
            `INSERT INTO onboarding (aplicacion_id, candidato_id, organization_id, fecha_inicio,
              email_bienvenida_estado, email_bienvenida_enviado_at)
             VALUES ($1, $2, $3, NOW(), $4, $5)`,
            [
              contrato.aplicacion_id, candidatoId, orgId,
              onboardingEnviado ? 'enviado' : 'pendiente',
              onboardingEnviado ? new Date().toISOString() : null,
            ]
          );
          console.log('[FIRMA] Registro de onboarding creado');
        }
      }
    } catch (onbError) {
      console.error('[FIRMA] Error creando registro onboarding:', onbError);
    }

    return apiResponse({
      estado: 'firmado',
      onboardingEnviado,
      message: onboardingEnviado
        ? 'Contrato firmado. Email de onboarding enviado al candidato.'
        : 'Contrato firmado. El email de onboarding no se pudo enviar.',
    });
  } catch (error) {
    return apiError(error);
  }
}
