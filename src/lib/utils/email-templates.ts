/**
 * Email HTML templates for selection and document notifications.
 * Inline CSS, Hirely branding, mobile responsive (max-width 600px).
 */

const HIRELY_STYLES = {
  wrapper: 'font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto;',
  header: 'background: #0A1F3F; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;',
  headerText: 'color: white; margin: 0; font-size: 22px; font-weight: bold;',
  body: 'background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;',
  h2: 'color: #0A1F3F; margin-top: 0; font-size: 20px;',
  p: 'color: #374151; line-height: 1.7; font-size: 15px;',
  ctaBtn: 'display: inline-block; background: #00BCD4; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;',
  footer: 'color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;',
  hr: 'border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;',
  listItem: 'color: #374151; font-size: 14px; line-height: 1.8;',
  badge: 'display: inline-block; background: #F0F9FF; color: #0A1F3F; padding: 4px 12px; border-radius: 12px; font-size: 13px; margin: 2px 4px;',
};

export function emailSeleccionTemplate(params: {
  candidatoNombre: string;
  vacanteTitulo: string;
  empresaNombre: string;
  portalUrl: string;
  documentosRequeridos: { label: string; descripcion?: string }[];
  mensajePersonalizado?: string;
  fechaInicio?: string;
  salario?: string;
}): { subject: string; htmlBody: string; textBody: string } {
  const docsHtml = params.documentosRequeridos
    .map(d => `<li style="${HIRELY_STYLES.listItem}"><strong>${d.label}</strong>${d.descripcion ? ` — ${d.descripcion}` : ''}</li>`)
    .join('');

  const detallesOferta = [];
  if (params.fechaInicio) detallesOferta.push(`<strong>Fecha de inicio tentativa:</strong> ${params.fechaInicio}`);
  if (params.salario) detallesOferta.push(`<strong>Salario ofrecido:</strong> ${params.salario}`);

  const htmlBody = `
    <div style="${HIRELY_STYLES.wrapper}">
      <div style="${HIRELY_STYLES.header}">
        <h1 style="${HIRELY_STYLES.headerText}">${params.empresaNombre}</h1>
      </div>
      <div style="${HIRELY_STYLES.body}">
        <h2 style="${HIRELY_STYLES.h2}">Felicidades, ${params.candidatoNombre}!</h2>
        <p style="${HIRELY_STYLES.p}">
          Nos complace informarte que has sido <strong>seleccionado(a)</strong> para la posicion de
          <strong>${params.vacanteTitulo}</strong> en <strong>${params.empresaNombre}</strong>.
        </p>
        ${params.mensajePersonalizado ? `<p style="${HIRELY_STYLES.p}">${params.mensajePersonalizado}</p>` : ''}
        ${detallesOferta.length > 0 ? `
          <div style="background: #F0F9FF; padding: 16px; border-radius: 8px; margin: 20px 0;">
            ${detallesOferta.map(d => `<p style="color: #0A1F3F; font-size: 14px; margin: 4px 0;">${d}</p>`).join('')}
          </div>
        ` : ''}
        <hr style="${HIRELY_STYLES.hr}">
        <h3 style="color: #0A1F3F; font-size: 16px;">Documentos requeridos</h3>
        <p style="${HIRELY_STYLES.p}">Para continuar con el proceso, necesitamos que subas los siguientes documentos:</p>
        <ul style="padding-left: 20px; margin: 16px 0;">
          ${docsHtml}
        </ul>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.portalUrl}" style="${HIRELY_STYLES.ctaBtn}">
            Subir mis documentos
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px; text-align: center;">
          El link expira en 30 dias. Si tienes problemas, contacta al equipo de recursos humanos.
        </p>
        <hr style="${HIRELY_STYLES.hr}">
        <p style="${HIRELY_STYLES.footer}">
          Este email fue enviado por ${params.empresaNombre} a traves de Hirely.
        </p>
      </div>
    </div>
  `;

  const docsText = params.documentosRequeridos
    .map(d => `- ${d.label}${d.descripcion ? `: ${d.descripcion}` : ''}`)
    .join('\n');

  const textBody = `Felicidades ${params.candidatoNombre}!\n\nHas sido seleccionado(a) para ${params.vacanteTitulo} en ${params.empresaNombre}.\n${params.mensajePersonalizado ? `\n${params.mensajePersonalizado}\n` : ''}\nDocumentos requeridos:\n${docsText}\n\nSube tus documentos aqui: ${params.portalUrl}\n\nEl link expira en 30 dias.`;

  return {
    subject: `Felicidades! Has sido seleccionado(a) para ${params.vacanteTitulo}`,
    htmlBody,
    textBody,
  };
}

export function emailRechazoTemplate(params: {
  candidatoNombre: string;
  vacanteTitulo: string;
  empresaNombre: string;
  mensajePersonalizado?: string;
}): { subject: string; htmlBody: string; textBody: string } {
  const htmlBody = `
    <div style="${HIRELY_STYLES.wrapper}">
      <div style="${HIRELY_STYLES.header}">
        <h1 style="${HIRELY_STYLES.headerText}">${params.empresaNombre}</h1>
      </div>
      <div style="${HIRELY_STYLES.body}">
        <h2 style="${HIRELY_STYLES.h2}">Estimado(a) ${params.candidatoNombre},</h2>
        <p style="${HIRELY_STYLES.p}">
          Queremos agradecerte sinceramente por tu interes en la posicion de
          <strong>${params.vacanteTitulo}</strong> en <strong>${params.empresaNombre}</strong>
          y por el tiempo que invertiste en el proceso de seleccion.
        </p>
        <p style="${HIRELY_STYLES.p}">
          Despues de una cuidadosa evaluacion, hemos decidido continuar con otro perfil
          que se ajusta mas a las necesidades actuales del cargo.
        </p>
        ${params.mensajePersonalizado ? `<p style="${HIRELY_STYLES.p}">${params.mensajePersonalizado}</p>` : ''}
        <p style="${HIRELY_STYLES.p}">
          Valoramos mucho tu perfil profesional y te animamos a postularte a futuras
          vacantes en ${params.empresaNombre}. Tu talento y dedicacion seran sin duda un
          gran aporte en la oportunidad indicada.
        </p>
        <p style="${HIRELY_STYLES.p}">
          Te deseamos mucho exito en tu busqueda laboral y en tus proyectos futuros.
        </p>
        <p style="${HIRELY_STYLES.p}">
          Cordialmente,<br/>
          <strong>Equipo de Recursos Humanos</strong><br/>
          ${params.empresaNombre}
        </p>
        <hr style="${HIRELY_STYLES.hr}">
        <p style="${HIRELY_STYLES.footer}">
          Este email fue enviado por ${params.empresaNombre} a traves de Hirely.
        </p>
      </div>
    </div>
  `;

  const textBody = `Estimado(a) ${params.candidatoNombre},\n\nQueremos agradecerte por tu interes en ${params.vacanteTitulo} en ${params.empresaNombre} y por el tiempo invertido en el proceso.\n\nDespues de una cuidadosa evaluacion, hemos decidido continuar con otro perfil.\n${params.mensajePersonalizado ? `\n${params.mensajePersonalizado}\n` : ''}\nTe animamos a postularte a futuras vacantes. Te deseamos mucho exito.\n\nCordialmente,\nEquipo de Recursos Humanos\n${params.empresaNombre}`;

  return {
    subject: `Gracias por tu interes en ${params.vacanteTitulo} — ${params.empresaNombre}`,
    htmlBody,
    textBody,
  };
}

export function emailDocumentosCompletosTemplate(params: {
  reclutadorNombre: string;
  candidatoNombre: string;
  vacanteTitulo: string;
  dashboardUrl: string;
}): { subject: string; htmlBody: string; textBody: string } {
  const htmlBody = `
    <div style="${HIRELY_STYLES.wrapper}">
      <div style="${HIRELY_STYLES.header}">
        <h1 style="${HIRELY_STYLES.headerText}">Hirely</h1>
      </div>
      <div style="${HIRELY_STYLES.body}">
        <h2 style="${HIRELY_STYLES.h2}">Documentos completos</h2>
        <p style="${HIRELY_STYLES.p}">
          Hola ${params.reclutadorNombre},
        </p>
        <p style="${HIRELY_STYLES.p}">
          <strong>${params.candidatoNombre}</strong> ha subido todos los documentos requeridos
          para la posicion de <strong>${params.vacanteTitulo}</strong>.
        </p>
        <p style="${HIRELY_STYLES.p}">
          Puedes revisar y verificar los documentos desde el panel de administracion.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.dashboardUrl}" style="${HIRELY_STYLES.ctaBtn}">
            Ver documentos
          </a>
        </div>
        <hr style="${HIRELY_STYLES.hr}">
        <p style="${HIRELY_STYLES.footer}">
          Notificacion automatica de Hirely.
        </p>
      </div>
    </div>
  `;

  const textBody = `Hola ${params.reclutadorNombre},\n\n${params.candidatoNombre} ha subido todos los documentos requeridos para ${params.vacanteTitulo}.\n\nRevisa los documentos aqui: ${params.dashboardUrl}`;

  return {
    subject: `Documentos completos: ${params.candidatoNombre} — ${params.vacanteTitulo}`,
    htmlBody,
    textBody,
  };
}
