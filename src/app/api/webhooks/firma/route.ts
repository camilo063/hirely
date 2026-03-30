import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { crearNotificacion } from '@/lib/services/notificaciones.service';
import { emitirNotificacion } from '@/lib/services/sse-clients';

/**
 * Webhook receiver for firma providers (SignWell, DocuSign, etc.)
 *
 * Always returns 200 OK — even on internal errors — to prevent
 * the provider from retrying indefinitely.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Webhook Firma] Received:', JSON.stringify(body).substring(0, 500));

    // Determine event type and external ID from different providers
    let externalId: string | null = null;
    let eventType: string | null = null;
    let completedAt: string | null = null;

    // SignWell format
    if (body.document_id || body.id) {
      externalId = body.document_id || body.id;
      eventType = body.event_type || body.status || body.event;
      completedAt = body.completed_at ?? null;
    }

    // DocuSign / legacy format
    if (body.envelope_id) {
      externalId = body.envelope_id;
      eventType = body.event;
      completedAt = body.completed_at ?? null;
    }

    if (!externalId) {
      console.log('[Webhook Firma] No external ID found in payload');
      return Response.json({ received: true, processed: false }, { status: 200 });
    }

    // Find contrato
    const contratoResult = await pool.query(
      'SELECT id, organization_id, aplicacion_id FROM contratos WHERE firma_external_id = $1',
      [externalId]
    );

    if (contratoResult.rows.length === 0) {
      console.log(`[Webhook Firma] Contrato not found for external ID: ${externalId}`);
      return Response.json({ received: true, processed: false }, { status: 200 });
    }

    const { id, organization_id, aplicacion_id } = contratoResult.rows[0];

    // Process event
    const completedEvents = ['completed', 'signed', 'document.completed'];
    const declinedEvents = ['declined', 'voided', 'document.declined'];

    if (completedEvents.includes(eventType ?? '')) {
      const firmadoAtValue = completedAt || new Date().toISOString();

      await pool.query(
        `UPDATE contratos SET estado = 'firmado', firmado_at = $3, updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [id, organization_id, firmadoAtValue]
      );

      // Activity log
      await pool.query(
        `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
         VALUES ($1, 'contrato', $2, 'firmado', $3)`,
        [organization_id, id, JSON.stringify({ via: 'webhook', external_id: externalId })]
      );

      console.log(`[Webhook Firma] Contrato ${id} marcado como firmado`);

      // Notificacion en tiempo real
      try {
        const contratoInfo = await pool.query(
          `SELECT c.nombre as candidato_nombre, c.apellido as candidato_apellido
           FROM contratos ct
           JOIN candidatos c ON ct.candidato_id = c.id
           WHERE ct.id = $1`,
          [id]
        );
        const candidatoNombreFirma = contratoInfo.rows.length > 0
          ? `${contratoInfo.rows[0].candidato_nombre} ${contratoInfo.rows[0].candidato_apellido || ''}`.trim()
          : 'Candidato';
        const notif = await crearNotificacion({
          organizacionId: organization_id,
          tipo: 'contrato_firmado_bilateral',
          titulo: 'Contrato firmado',
          mensaje: `${candidatoNombreFirma} firmo el contrato`,
          meta: { contrato_id: id, url: `/contratos/${id}` },
        });
        if (notif) {
          emitirNotificacion(organization_id, {
            type: 'notificacion',
            id: notif.id,
            tipo: 'contrato_firmado_bilateral',
            titulo: 'Contrato firmado',
            mensaje: `${candidatoNombreFirma} firmo el contrato`,
            browser_activo: notif.browser_activo,
            meta: { contrato_id: id, url: `/contratos/${id}` },
            created_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error('[notificacion] Error:', e);
      }

      // ── Side effects: notifications + onboarding ──
      // All wrapped in try/catch — webhook MUST always return 200
      try {
        await notificarContratoFirmado(id, organization_id, aplicacion_id, firmadoAtValue);
      } catch (err) {
        console.error('[Webhook Firma] Error en notificaciones post-firma:', err);
      }

      try {
        await prepararOnboarding(id, organization_id, aplicacion_id);
      } catch (err) {
        console.error('[Webhook Firma] Error preparando onboarding:', err);
      }
    } else if (declinedEvents.includes(eventType ?? '')) {
      await pool.query(
        `UPDATE contratos SET estado = 'rechazado', updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [id, organization_id]
      );

      await pool.query(
        `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
         VALUES ($1, 'contrato', $2, 'firma_rechazada', $3)`,
        [organization_id, id, JSON.stringify({ via: 'webhook', external_id: externalId })]
      );

      console.log(`[Webhook Firma] Contrato ${id} firma rechazada`);
    }

    return Response.json({ received: true, processed: true }, { status: 200 });
  } catch (error) {
    console.error('[Webhook Firma] Error processing:', error);
    // Always return 200 for webhooks
    return Response.json({ received: true, processed: false, error: 'Internal error' }, { status: 200 });
  }
}

// ─── SIDE EFFECTS ────────────────────────────────────

/**
 * Send email notifications when a contract is signed:
 * - Admin(s): "Contrato firmado — {candidato} | {vacante}"
 * - Candidate: "Tu contrato ha sido firmado exitosamente"
 */
async function notificarContratoFirmado(
  contratoId: string,
  orgId: string,
  aplicacionId: string,
  firmadoAt: string
): Promise<void> {
  // Get contrato details with candidate, vacante, and org info
  const result = await pool.query(
    `SELECT ct.id,
            c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
            v.titulo as vacante_titulo, v.id as vacante_id,
            o.name as org_nombre
     FROM contratos ct
     JOIN candidatos c ON ct.candidato_id = c.id
     JOIN vacantes v ON ct.vacante_id = v.id
     JOIN organizations o ON o.id = ct.organization_id
     WHERE ct.id = $1 AND ct.organization_id = $2`,
    [contratoId, orgId]
  );

  if (result.rows.length === 0) {
    console.warn('[Webhook Firma] No se encontro contrato para notificacion:', contratoId);
    return;
  }

  const contrato = result.rows[0];
  const candidatoNombre = `${contrato.candidato_nombre} ${contrato.candidato_apellido || ''}`.trim();

  const { enviarEmail } = await import('@/lib/services/email.service');
  const {
    emailContratoFirmadoAdminTemplate,
    emailContratoFirmadoCandidatoTemplate,
  } = await import('@/lib/utils/email-templates');

  // Format firmado_at for display
  const firmadoDate = new Date(firmadoAt);
  const firmadoFormatted = firmadoDate.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Build dashboard URL for admin
  let dashboardUrl = '';
  try {
    const { getAppUrl } = await import('@/lib/utils/url');
    dashboardUrl = `${getAppUrl()}/aplicaciones/${aplicacionId}`;
  } catch {
    dashboardUrl = '#';
  }

  // 1. Notify admin(s)
  try {
    const adminResult = await pool.query(
      `SELECT email FROM users WHERE organization_id = $1 AND role = 'admin' AND is_active = true`,
      [orgId]
    );
    const adminEmails = adminResult.rows.map((r: { email: string }) => r.email);

    if (adminEmails.length > 0) {
      const adminTemplate = emailContratoFirmadoAdminTemplate({
        candidatoNombre,
        vacanteTitulo: contrato.vacante_titulo,
        empresaNombre: contrato.org_nombre,
        dashboardUrl,
        firmadoAt: firmadoFormatted,
      });

      await enviarEmail({
        to: adminEmails,
        subject: adminTemplate.subject,
        html: adminTemplate.htmlBody,
      });
      console.log(`[Webhook Firma] Email admin enviado a: ${adminEmails.join(', ')}`);
    }
  } catch (err) {
    console.error('[Webhook Firma] Error enviando email a admins:', err);
  }

  // 2. Notify candidate
  try {
    if (contrato.candidato_email) {
      const candidatoTemplate = emailContratoFirmadoCandidatoTemplate({
        candidatoNombre,
        vacanteTitulo: contrato.vacante_titulo,
        empresaNombre: contrato.org_nombre,
      });

      await enviarEmail({
        to: contrato.candidato_email,
        subject: candidatoTemplate.subject,
        html: candidatoTemplate.htmlBody,
      });
      console.log(`[Webhook Firma] Email candidato enviado a: ${contrato.candidato_email}`);
    }
  } catch (err) {
    console.error('[Webhook Firma] Error enviando email a candidato:', err);
  }
}

/**
 * Auto-trigger onboarding after contract signature.
 *
 * iniciarOnboarding requires `fechaInicio` and the aplicacion must be in estado 'seleccionado',
 * which may not always be the case at signing time. Instead of calling it directly:
 * 1. Update aplicacion estado to 'contratado' if it's in 'seleccionado'
 * 2. Send admin an email: "Contrato firmado, listo para iniciar onboarding" with a link
 *    so the admin can set fecha_inicio and other onboarding params manually.
 */
async function prepararOnboarding(
  contratoId: string,
  orgId: string,
  aplicacionId: string
): Promise<void> {
  if (!aplicacionId) {
    console.log('[Webhook Firma] No aplicacion_id en contrato, omitiendo onboarding');
    return;
  }

  // Check current application state
  const appResult = await pool.query(
    `SELECT a.estado, a.candidato_id, c.nombre as candidato_nombre, c.apellido as candidato_apellido,
            v.titulo as vacante_titulo
     FROM aplicaciones a
     JOIN candidatos c ON c.id = a.candidato_id
     JOIN vacantes v ON v.id = a.vacante_id
     WHERE a.id = $1`,
    [aplicacionId]
  );

  if (appResult.rows.length === 0) return;
  const app = appResult.rows[0];

  // Update estado to 'contratado' if currently 'seleccionado'
  if (app.estado === 'seleccionado') {
    await pool.query(
      `UPDATE aplicaciones SET estado = 'contratado', updated_at = NOW() WHERE id = $1`,
      [aplicacionId]
    );

    await pool.query(
      `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
       VALUES ($1, 'aplicacion', $2, 'contratado_auto', $3)`,
      [orgId, aplicacionId, JSON.stringify({
        via: 'webhook_firma',
        contrato_id: contratoId,
      })]
    );

    console.log(`[Webhook Firma] Aplicacion ${aplicacionId} actualizada a estado 'contratado'`);
  }

  // Send admin notification to manually start onboarding (fecha_inicio is required)
  try {
    const { enviarEmail } = await import('@/lib/services/email.service');

    let dashboardUrl = '#';
    try {
      const { getAppUrl } = await import('@/lib/utils/url');
      dashboardUrl = `${getAppUrl()}/aplicaciones/${aplicacionId}`;
    } catch { /* ignore */ }

    const candidatoNombre = `${app.candidato_nombre} ${app.candidato_apellido || ''}`.trim();

    const adminResult = await pool.query(
      `SELECT email FROM users WHERE organization_id = $1 AND role = 'admin' AND is_active = true`,
      [orgId]
    );
    const adminEmails = adminResult.rows.map((r: { email: string }) => r.email);

    if (adminEmails.length > 0) {
      await enviarEmail({
        to: adminEmails,
        subject: `Listo para onboarding — ${candidatoNombre} | ${app.vacante_titulo}`,
        html: `
          <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #0A1F3F; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 22px;">Hirely</h1>
            </div>
            <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <h2 style="color: #0A1F3F; margin-top: 0; font-size: 20px;">Onboarding pendiente</h2>
              <p style="color: #374151; line-height: 1.7; font-size: 15px;">
                El contrato de <strong>${candidatoNombre}</strong> para la posicion de
                <strong>${app.vacante_titulo}</strong> ha sido firmado.
              </p>
              <p style="color: #374151; line-height: 1.7; font-size: 15px;">
                El candidato esta listo para iniciar su proceso de onboarding. Por favor ingresa al
                panel para configurar la fecha de inicio y enviar el email de bienvenida.
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${dashboardUrl}" style="display: inline-block; background: #00BCD4; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                  Iniciar onboarding
                </a>
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;">
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                Notificacion automatica de Hirely.
              </p>
            </div>
          </div>
        `,
      });
      console.log(`[Webhook Firma] Email onboarding pendiente enviado a admins`);
    }
  } catch (err) {
    console.error('[Webhook Firma] Error notificando onboarding pendiente:', err);
  }
}
