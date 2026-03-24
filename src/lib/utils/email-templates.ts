/**
 * Email HTML templates for selection and document notifications.
 * Inline CSS, Hirely branding, mobile responsive (max-width 600px).
 */

// ─── DEFAULT TEMPLATES (used as fallback when org has no custom template) ──

export const DEFAULT_TEMPLATE_SELECCION = `<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #0A1F3F; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Felicitaciones, {{candidato_nombre}}!</h1>
    <p style="color: #00BCD4; margin: 10px 0 0; font-size: 16px;">Has sido seleccionado/a</p>
  </div>
  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="color: #374151; line-height: 1.7;">Nos complace informarte que has sido seleccionado/a para el cargo de <strong>{{vacante_titulo}}</strong> en <strong>{{empresa_nombre}}</strong>.</p>
    <p style="color: #374151; line-height: 1.7;">Para continuar, necesitamos que cargues los siguientes documentos:<br><strong>{{documentos_requeridos}}</strong></p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{portal_url}}" style="background: #00BCD4; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Subir mis documentos</a>
    </div>
    <p style="color: #6B7280; font-size: 14px;">Tienes hasta el <strong>{{fecha_limite_docs}}</strong> para cargar los documentos.</p>
  </div>
  <div style="background: #F9FAFB; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e5e7eb; border-top: none;">
    <p style="color: #9CA3AF; font-size: 12px; margin: 0;">{{empresa_nombre}} · Powered by Hirely</p>
  </div>
</div>`;

export const DEFAULT_TEMPLATE_RECHAZO = `<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #0A1F3F; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">{{empresa_nombre}}</h1>
    <p style="color: #CBD5E1; margin: 10px 0 0; font-size: 14px;">Proceso de seleccion</p>
  </div>
  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="color: #374151; line-height: 1.7;">Estimado/a <strong>{{candidato_nombre}}</strong>,</p>
    <p style="color: #374151; line-height: 1.7;">Agradecemos tu interes en el cargo de <strong>{{vacante_titulo}}</strong> y el tiempo dedicado a nuestro proceso de seleccion.</p>
    <p style="color: #374151; line-height: 1.7;">Luego de una cuidadosa evaluacion, hemos tomado la decision de continuar con otros candidatos cuyo perfil se ajusta mejor a los requerimientos del cargo en este momento.</p>
    <p style="color: #374151; line-height: 1.7;">Te animamos a seguir pendiente de nuestras oportunidades futuras.</p>
    <p style="color: #374151;">Cordialmente,<br><strong>Equipo de {{empresa_nombre}}</strong></p>
  </div>
  <div style="background: #F9FAFB; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e5e7eb; border-top: none;">
    <p style="color: #9CA3AF; font-size: 12px; margin: 0;">{{empresa_nombre}} · Powered by Hirely</p>
  </div>
</div>`;

// Example values for variable preview in the UI
export const VARIABLES_SELECCION = [
  { key: 'candidato_nombre', label: 'Nombre del candidato', ejemplo: 'Maria Garcia Lopez' },
  { key: 'vacante_titulo', label: 'Titulo de la vacante', ejemplo: 'Desarrollador Full Stack' },
  { key: 'empresa_nombre', label: 'Nombre de la empresa', ejemplo: 'Hirely Demo' },
  { key: 'portal_url', label: 'URL del portal de documentos', ejemplo: 'https://hirely.app/portal/documentos/abc123' },
  { key: 'documentos_requeridos', label: 'Documentos requeridos', ejemplo: 'Cedula, Certificado laboral, RUT' },
  { key: 'fecha_limite_docs', label: 'Fecha limite documentos', ejemplo: '15 de abril de 2026' },
  { key: 'fecha_inicio', label: 'Fecha de inicio', ejemplo: '1 de mayo de 2026' },
  { key: 'salario', label: 'Salario ofrecido', ejemplo: '5.000.000 COP' },
];

export const VARIABLES_RECHAZO = [
  { key: 'candidato_nombre', label: 'Nombre del candidato', ejemplo: 'Maria Garcia Lopez' },
  { key: 'vacante_titulo', label: 'Titulo de la vacante', ejemplo: 'Desarrollador Full Stack' },
  { key: 'empresa_nombre', label: 'Nombre de la empresa', ejemplo: 'Hirely Demo' },
];

/** Substitute {{variable}} placeholders in a template string */
export function sustituirVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '');
}

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

export function emailNotificacionDapta(params: {
  candidatoNombre: string;
  vacanteTitulo: string;
  scoreIA: number;
  recomendacion: string;
  duracionSegundos: number;
  dashboardUrl: string;
}): { subject: string; htmlBody: string } {
  const duracionMin = Math.round(params.duracionSegundos / 60);
  const scoreColor = params.scoreIA >= 70 ? '#16a34a' : params.scoreIA >= 50 ? '#d97706' : '#dc2626';

  const htmlBody = `
    <div style="${HIRELY_STYLES.wrapper}">
      <div style="${HIRELY_STYLES.header}">
        <h1 style="${HIRELY_STYLES.headerText}">Hirely</h1>
      </div>
      <div style="${HIRELY_STYLES.body}">
        <h2 style="${HIRELY_STYLES.h2}">Entrevista IA completada</h2>
        <p style="${HIRELY_STYLES.p}">
          La entrevista IA con <strong>${params.candidatoNombre}</strong> para la posicion de
          <strong>${params.vacanteTitulo}</strong> ha finalizado.
        </p>
        <div style="background: #F0F9FF; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #0A1F3F; font-size: 14px; margin: 4px 0;">
            <strong>Score IA:</strong> <span style="color: ${scoreColor}; font-size: 18px; font-weight: bold;">${params.scoreIA}/100</span>
          </p>
          <p style="color: #0A1F3F; font-size: 14px; margin: 4px 0;">
            <strong>Duracion:</strong> ${duracionMin} minutos
          </p>
          <p style="color: #0A1F3F; font-size: 14px; margin: 4px 0;">
            <strong>Recomendacion:</strong> ${params.recomendacion}
          </p>
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.dashboardUrl}" style="${HIRELY_STYLES.ctaBtn}">
            Ver detalle de la entrevista
          </a>
        </div>
        <hr style="${HIRELY_STYLES.hr}">
        <p style="${HIRELY_STYLES.footer}">
          Notificacion automatica de Hirely.
        </p>
      </div>
    </div>
  `;

  return {
    subject: `Entrevista IA completada: ${params.candidatoNombre} — ${params.vacanteTitulo} (${params.scoreIA}/100)`,
    htmlBody,
  };
}

export function emailNotificacionEvaluacion(params: {
  candidatoNombre: string;
  vacanteTitulo: string;
  scoreTecnico: number;
  puntajeAprobatorio: number;
  aprobada: boolean;
  dashboardUrl: string;
}): { subject: string; htmlBody: string } {
  const scoreColor = params.aprobada ? '#16a34a' : '#dc2626';
  const estadoLabel = params.aprobada ? 'Aprobada' : 'No aprobada';
  const estadoBadgeColor = params.aprobada ? '#dcfce7' : '#fee2e2';
  const estadoTextColor = params.aprobada ? '#166534' : '#991b1b';

  const htmlBody = `
    <div style="${HIRELY_STYLES.wrapper}">
      <div style="${HIRELY_STYLES.header}">
        <h1 style="${HIRELY_STYLES.headerText}">Hirely</h1>
      </div>
      <div style="${HIRELY_STYLES.body}">
        <h2 style="${HIRELY_STYLES.h2}">Evaluacion tecnica completada</h2>
        <p style="${HIRELY_STYLES.p}">
          <strong>${params.candidatoNombre}</strong> ha completado la evaluacion tecnica para la posicion de
          <strong>${params.vacanteTitulo}</strong>.
        </p>
        <div style="background: #F0F9FF; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #0A1F3F; font-size: 14px; margin: 4px 0;">
            <strong>Score Tecnico:</strong> <span style="color: ${scoreColor}; font-size: 18px; font-weight: bold;">${params.scoreTecnico}/100</span>
          </p>
          <p style="color: #0A1F3F; font-size: 14px; margin: 4px 0;">
            <strong>Puntaje aprobatorio:</strong> ${params.puntajeAprobatorio}/100
          </p>
          <p style="color: #0A1F3F; font-size: 14px; margin: 8px 0 0 0;">
            <span style="display: inline-block; background: ${estadoBadgeColor}; color: ${estadoTextColor}; padding: 4px 16px; border-radius: 12px; font-weight: bold; font-size: 14px;">
              ${estadoLabel}
            </span>
          </p>
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.dashboardUrl}" style="${HIRELY_STYLES.ctaBtn}">
            Ver detalle de la evaluacion
          </a>
        </div>
        <hr style="${HIRELY_STYLES.hr}">
        <p style="${HIRELY_STYLES.footer}">
          Notificacion automatica de Hirely.
        </p>
      </div>
    </div>
  `;

  return {
    subject: `Evaluacion tecnica ${estadoLabel.toLowerCase()}: ${params.candidatoNombre} — ${params.vacanteTitulo} (${params.scoreTecnico}/100)`,
    htmlBody,
  };
}

export function emailContratoFirmadoAdminTemplate(params: {
  candidatoNombre: string;
  vacanteTitulo: string;
  empresaNombre: string;
  dashboardUrl: string;
  firmadoAt: string;
}): { subject: string; htmlBody: string } {
  const htmlBody = `
    <div style="${HIRELY_STYLES.wrapper}">
      <div style="${HIRELY_STYLES.header}">
        <h1 style="${HIRELY_STYLES.headerText}">Hirely</h1>
      </div>
      <div style="${HIRELY_STYLES.body}">
        <h2 style="${HIRELY_STYLES.h2}">Contrato firmado</h2>
        <p style="${HIRELY_STYLES.p}">
          El contrato de <strong>${params.candidatoNombre}</strong> para la posicion de
          <strong>${params.vacanteTitulo}</strong> ha sido firmado exitosamente.
        </p>
        <div style="background: #dcfce7; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #166534; font-size: 14px; margin: 4px 0;">
            <strong>Candidato:</strong> ${params.candidatoNombre}
          </p>
          <p style="color: #166534; font-size: 14px; margin: 4px 0;">
            <strong>Vacante:</strong> ${params.vacanteTitulo}
          </p>
          <p style="color: #166534; font-size: 14px; margin: 4px 0;">
            <strong>Firmado:</strong> ${params.firmadoAt}
          </p>
        </div>
        <p style="${HIRELY_STYLES.p}">
          El candidato esta listo para iniciar el proceso de onboarding.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.dashboardUrl}" style="${HIRELY_STYLES.ctaBtn}">
            Iniciar onboarding
          </a>
        </div>
        <hr style="${HIRELY_STYLES.hr}">
        <p style="${HIRELY_STYLES.footer}">
          Notificacion automatica de Hirely.
        </p>
      </div>
    </div>
  `;

  return {
    subject: `Contrato firmado — ${params.candidatoNombre} | ${params.vacanteTitulo}`,
    htmlBody,
  };
}

export function emailContratoFirmadoCandidatoTemplate(params: {
  candidatoNombre: string;
  vacanteTitulo: string;
  empresaNombre: string;
}): { subject: string; htmlBody: string } {
  const htmlBody = `
    <div style="${HIRELY_STYLES.wrapper}">
      <div style="${HIRELY_STYLES.header}">
        <h1 style="${HIRELY_STYLES.headerText}">${params.empresaNombre}</h1>
      </div>
      <div style="${HIRELY_STYLES.body}">
        <h2 style="${HIRELY_STYLES.h2}">Tu contrato ha sido firmado exitosamente</h2>
        <p style="${HIRELY_STYLES.p}">
          Hola <strong>${params.candidatoNombre}</strong>,
        </p>
        <p style="${HIRELY_STYLES.p}">
          Te confirmamos que tu contrato para la posicion de <strong>${params.vacanteTitulo}</strong>
          en <strong>${params.empresaNombre}</strong> ha sido firmado correctamente por todas las partes.
        </p>
        <div style="background: #dcfce7; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="color: #166534; font-size: 16px; font-weight: bold; margin: 0;">
            Firma completada
          </p>
        </div>
        <p style="${HIRELY_STYLES.p}">
          Pronto recibiras mas informacion sobre los siguientes pasos y tu proceso de onboarding.
          Si tienes alguna pregunta, no dudes en contactar al equipo de recursos humanos.
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

  return {
    subject: `Tu contrato ha sido firmado exitosamente — ${params.vacanteTitulo}`,
    htmlBody,
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

export function emailDocumentoRechazadoTemplate(params: {
  candidatoNombre: string;
  empresaNombre: string;
  vacanteTitulo: string;
  documentoTipo: string;
  motivoRechazo: string;
  portalUrl: string;
}): { subject: string; htmlBody: string; textBody: string } {
  const htmlBody = `
    <div style="${HIRELY_STYLES.wrapper}">
      <div style="${HIRELY_STYLES.header}">
        <h1 style="${HIRELY_STYLES.headerText}">${params.empresaNombre}</h1>
      </div>
      <div style="${HIRELY_STYLES.body}">
        <h2 style="${HIRELY_STYLES.h2}">Documento requiere correccion</h2>
        <p style="${HIRELY_STYLES.p}">
          Hola ${params.candidatoNombre},
        </p>
        <p style="${HIRELY_STYLES.p}">
          Te informamos que el documento <strong>${params.documentoTipo}</strong> que enviaste
          para la posicion de <strong>${params.vacanteTitulo}</strong> ha sido
          <span style="color: #dc2626; font-weight: bold;">rechazado</span>.
        </p>
        <div style="background: #FEF2F2; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <p style="color: #991b1b; font-size: 14px; margin: 0;">
            <strong>Motivo:</strong> ${params.motivoRechazo}
          </p>
        </div>
        <p style="${HIRELY_STYLES.p}">
          Por favor, sube nuevamente el documento corregido a traves del portal de documentos.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.portalUrl}" style="${HIRELY_STYLES.ctaBtn}">
            Subir documento corregido
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px; text-align: center;">
          Si tienes dudas, contacta al equipo de recursos humanos.
        </p>
        <hr style="${HIRELY_STYLES.hr}">
        <p style="${HIRELY_STYLES.footer}">
          Este email fue enviado por ${params.empresaNombre} a traves de Hirely.
        </p>
      </div>
    </div>
  `;

  const textBody = `Hola ${params.candidatoNombre},\n\nEl documento "${params.documentoTipo}" que enviaste para ${params.vacanteTitulo} ha sido rechazado.\n\nMotivo: ${params.motivoRechazo}\n\nPor favor, sube el documento corregido aqui: ${params.portalUrl}\n\nSi tienes dudas, contacta al equipo de recursos humanos.`;

  return {
    subject: `Documento rechazado: ${params.documentoTipo} — ${params.vacanteTitulo}`,
    htmlBody,
    textBody,
  };
}

export function emailContratadoTemplate(params: {
  candidatoNombre: string;
  vacanteTitulo: string;
  empresaNombre: string;
  salario?: string;
  fechaInicio?: string;
}): { subject: string; htmlBody: string } {
  const detalles = [];
  if (params.salario) detalles.push(`<p style="color: #374151; margin: 6px 0;"><strong>Salario:</strong> ${params.salario}</p>`);
  if (params.fechaInicio) detalles.push(`<p style="color: #374151; margin: 6px 0;"><strong>Fecha de inicio:</strong> ${params.fechaInicio}</p>`);

  const htmlBody = `
    <div style="${HIRELY_STYLES.wrapper}">
      <div style="background: linear-gradient(135deg, #0A1F3F 0%, #1a3a6b 100%); padding: 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 12px;">&#127881;</div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Felicitaciones!</h1>
        <p style="color: #94c8f5; margin: 8px 0 0; font-size: 16px;">Has sido seleccionado/a</p>
      </div>
      <div style="${HIRELY_STYLES.body}">
        <p style="${HIRELY_STYLES.p}">
          Estimado/a <strong>${params.candidatoNombre}</strong>,
        </p>
        <p style="${HIRELY_STYLES.p}">
          Nos complace comunicarte que has sido seleccionado/a para el cargo de
          <strong>${params.vacanteTitulo}</strong> en <strong>${params.empresaNombre}</strong>.
        </p>
        ${detalles.length > 0 ? `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h3 style="color: #166534; margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
            Detalles de tu vinculacion
          </h3>
          ${detalles.join('')}
        </div>
        ` : ''}
        <p style="${HIRELY_STYLES.p}">
          En los proximos dias recibiras tu contrato para revision y firma electronica.
          Por favor manten tu correo atento.
        </p>
        <p style="${HIRELY_STYLES.p}">
          Bienvenido/a al equipo!
        </p>
        <hr style="${HIRELY_STYLES.hr}">
        <p style="${HIRELY_STYLES.footer}">
          Este email fue enviado por ${params.empresaNombre} a traves de Hirely.
        </p>
      </div>
    </div>
  `;

  return {
    subject: `Felicitaciones ${params.candidatoNombre}! Fuiste seleccionado/a para ${params.vacanteTitulo}`,
    htmlBody,
  };
}

export function emailOnboardingTemplate(params: {
  candidatoNombre: string;
  vacanteTitulo: string;
  empresaNombre: string;
}): { subject: string; htmlBody: string } {
  const htmlBody = `
    <div style="${HIRELY_STYLES.wrapper}">
      <div style="background: linear-gradient(135deg, #0A1F3F 0%, #1a3a6b 100%); padding: 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 12px;">&#128640;</div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Bienvenido/a!</h1>
        <p style="color: #94c8f5; margin: 8px 0 0; font-size: 16px;">Tu contrato ha sido firmado</p>
      </div>
      <div style="${HIRELY_STYLES.body}">
        <p style="${HIRELY_STYLES.p}">
          Hola <strong>${params.candidatoNombre}</strong>,
        </p>
        <p style="${HIRELY_STYLES.p}">
          Te confirmamos que tu contrato para la posicion de <strong>${params.vacanteTitulo}</strong>
          en <strong>${params.empresaNombre}</strong> ha sido firmado por todas las partes.
        </p>
        <div style="background: #dcfce7; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="color: #166534; font-size: 16px; font-weight: bold; margin: 0;">
            Contrato firmado exitosamente
          </p>
        </div>
        <p style="${HIRELY_STYLES.p}">
          Pronto recibiras informacion detallada sobre tu proceso de incorporacion,
          incluyendo fecha de inicio, documentacion adicional y contacto de tu equipo.
        </p>
        <p style="${HIRELY_STYLES.p}">
          Si tienes alguna pregunta, no dudes en contactar al equipo de recursos humanos.
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

  return {
    subject: `Bienvenido/a a ${params.empresaNombre}! — Informacion de incorporacion`,
    htmlBody,
  };
}
