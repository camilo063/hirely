/**
 * Email service — powered by Resend.
 *
 * - RESEND_API_KEY configured → sends via Resend API
 * - Not configured → logs to console (dev mode, non-blocking)
 *
 * This service is the ONLY place that sends email in Hirely.
 * All other services import `enviarEmail` from here.
 */

import { resendClient, EMAIL_FROM } from '@/lib/integrations/resend';

interface EnviarEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  cc?: string[];
  tags?: Record<string, string>;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function enviarEmail(params: EnviarEmailParams): Promise<EmailResult> {
  // Dev logging
  if (process.env.NODE_ENV === 'development') {
    const recipients = Array.isArray(params.to) ? params.to.join(', ') : params.to;
    console.log(`[Email] To: ${recipients}`);
    console.log(`[Email] Subject: ${params.subject}`);
    console.log(`[Email] Preview: ${params.html.replace(/<[^>]*>/g, '').substring(0, 150)}...`);
  }

  if (!resendClient) {
    console.warn('[Email] RESEND_API_KEY no configurada — email no enviado');
    return { success: false, error: 'Email no configurado' };
  }

  try {
    const { data, error } = await resendClient.emails.send({
      from: EMAIL_FROM,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
      cc: params.cc,
      tags: params.tags
        ? Object.entries(params.tags).map(([name, value]) => ({ name, value }))
        : undefined,
    });

    if (error) {
      console.error('[Email] Resend error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido enviando email';
    console.error('[Email] Exception:', message);
    return { success: false, error: message };
  }
}

// ─── BACKWARD COMPAT ─────────────────────────────
// Legacy `sendEmail` signature used by existing services.
// Maps old {to, subject, htmlBody, textBody, from, replyTo} → new enviarEmail.

interface LegacyEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail(params: LegacyEmailParams): Promise<boolean> {
  const result = await enviarEmail({
    to: params.to,
    subject: params.subject,
    html: params.htmlBody,
    replyTo: params.replyTo,
  });
  return result.success;
}

// ─── CONVENIENCE HELPERS ─────────────────────────
// Keep existing exported functions so nothing breaks.

export async function enviarInvitacionEntrevista(
  candidatoNombre: string,
  candidatoEmail: string,
  vacanteTitulo: string,
  empresaNombre: string,
  entrevistadorNombre: string,
  agendamientoUrl?: string
): Promise<boolean> {
  const htmlBody = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #0A1F3F; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Hirely</h1>
      </div>
      <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #0A1F3F; margin-top: 0;">Hola, ${candidatoNombre}!</h2>
        <p style="color: #374151; line-height: 1.6;">
          Hemos revisado tu perfil para la posicion de <strong>${vacanteTitulo}</strong> en
          <strong>${empresaNombre}</strong> y nos encantaria conocerte mejor.
        </p>
        <p style="color: #374151; line-height: 1.6;">
          Queremos invitarte a una entrevista con <strong>${entrevistadorNombre}</strong>.
        </p>
        ${agendamientoUrl ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${agendamientoUrl}" style="background: #00BCD4; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Agendar mi entrevista
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px; text-align: center;">
          Haz clic en el boton para elegir la fecha y hora que mejor te convenga.
        </p>
        ` : `
        <p style="color: #374151; line-height: 1.6;">
          Nos pondremos en contacto contigo pronto para coordinar fecha y hora.
        </p>
        `}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          Este email fue enviado por ${empresaNombre} a traves de Hirely.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: candidatoEmail,
    subject: `Invitacion a entrevista — ${vacanteTitulo} en ${empresaNombre}`,
    htmlBody: htmlBody,
    textBody: `Hola ${candidatoNombre}, nos encantaria conocerte para la posicion de ${vacanteTitulo} en ${empresaNombre}. ${agendamientoUrl ? `Agenda tu entrevista aqui: ${agendamientoUrl}` : 'Nos pondremos en contacto pronto.'}`,
  });
}

export async function sendInvitacionEntrevista(
  candidatoEmail: string,
  candidatoNombre: string,
  vacanteTitle: string,
  fechaProgramada: string,
  tipo: 'ia' | 'humana',
  callUrl?: string
): Promise<boolean> {
  const tipoLabel = tipo === 'ia' ? 'con IA' : 'presencial';
  return sendEmail({
    to: candidatoEmail,
    subject: `Invitacion a entrevista ${tipoLabel} - ${vacanteTitle}`,
    htmlBody: `
      <h2>Hola ${candidatoNombre},</h2>
      <p>Te invitamos a una entrevista ${tipoLabel} para la posicion de <strong>${vacanteTitle}</strong>.</p>
      <p><strong>Fecha:</strong> ${fechaProgramada}</p>
      ${callUrl ? `<p><strong>Link:</strong> <a href="${callUrl}">${callUrl}</a></p>` : ''}
      <p>Saludos,<br/>Equipo de Reclutamiento</p>
    `,
  });
}

export async function sendBienvenida(
  candidatoEmail: string,
  candidatoNombre: string,
  cargo: string,
  fechaInicio: string
): Promise<boolean> {
  return sendEmail({
    to: candidatoEmail,
    subject: `Bienvenido al equipo! - ${cargo}`,
    htmlBody: `
      <h2>Felicidades ${candidatoNombre}!</h2>
      <p>Nos complace darte la bienvenida como <strong>${cargo}</strong>.</p>
      <p>Tu fecha de inicio es el <strong>${fechaInicio}</strong>.</p>
      <p>Saludos,<br/>Equipo de Recursos Humanos</p>
    `,
  });
}

export async function sendContratoParaFirma(
  candidatoEmail: string,
  candidatoNombre: string,
  firmaUrl: string
): Promise<boolean> {
  return sendEmail({
    to: candidatoEmail,
    subject: 'Tu contrato esta listo para firmar',
    htmlBody: `
      <h2>Hola ${candidatoNombre},</h2>
      <p>Tu contrato de trabajo esta listo para ser firmado electronicamente.</p>
      <p><a href="${firmaUrl}" style="background-color: #00BCD4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Firmar contrato</a></p>
      <p>Saludos,<br/>Equipo de Recursos Humanos</p>
    `,
  });
}
