import { pool } from '@/lib/db';
import { sendEmail } from './email.service';
import { crearNotificacion } from '@/lib/services/notificaciones.service';
import { emitirNotificacion } from '@/lib/services/sse-clients';
import { UUID } from '@/lib/types/common.types';
import { DocumentoCandidato } from '@/lib/types/contrato.types';
import { NotFoundError } from '@/lib/utils/errors';
import type {
  OnboardingConfig,
  OnboardingCandidato,
  VariablesBienvenida,
} from '@/lib/types/onboarding.types';
import {
  PLANTILLA_BIENVENIDA_DEFAULT,
  ASUNTO_BIENVENIDA_DEFAULT,
} from '@/lib/types/onboarding.types';

// ═══════════════════════════════════════════════
// MODULE 8: ONBOARDING Y BIENVENIDA
// ═══════════════════════════════════════════════

export async function iniciarOnboarding(params: {
  aplicacionId: string;
  fechaInicio: string;
  variablesCustom?: Partial<VariablesBienvenida>;
  notasOnboarding?: string;
  enviarEmailAhora?: boolean;
  liderId?: string;
  orgId: string;
  userId: string;
}): Promise<OnboardingCandidato> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify application
    const appResult = await client.query(
      `SELECT a.id, a.candidato_id, a.vacante_id, a.estado, a.tipo_contrato,
              a.salario_ofrecido, a.moneda, a.fecha_inicio_tentativa,
              c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
              v.titulo as vacante_titulo, v.departamento, v.modalidad, v.ubicacion,
              o.name as org_nombre
       FROM aplicaciones a
       JOIN candidatos c ON c.id = a.candidato_id
       JOIN vacantes v ON v.id = a.vacante_id
       JOIN organizations o ON o.id = v.organization_id
       WHERE a.id = $1 AND v.organization_id = $2`,
      [params.aplicacionId, params.orgId]
    );

    if (appResult.rows.length === 0) throw new Error('Aplicación no encontrada');
    const app = appResult.rows[0];

    if (app.estado !== 'seleccionado') {
      throw new Error(`Solo se puede contratar candidatos en estado "seleccionado". Estado actual: ${app.estado}`);
    }

    // 2. Update application to contratado
    await client.query(
      `UPDATE aplicaciones SET estado = 'contratado', fecha_inicio_tentativa = $2, updated_at = NOW()
       WHERE id = $1`,
      [params.aplicacionId, params.fechaInicio]
    );

    // 3. Get leader info if provided
    let liderNombre = 'Tu líder directo';
    let liderEmail = '';
    if (params.liderId) {
      const liderResult = await client.query(
        `SELECT name, email FROM users WHERE id = $1 AND organization_id = $2`,
        [params.liderId, params.orgId]
      );
      if (liderResult.rows.length > 0) {
        liderNombre = liderResult.rows[0].name;
        liderEmail = liderResult.rows[0].email;
      }
    }

    // 4. Build variables
    const variables = buildVariablesBienvenida({
      candidatoNombre: `${app.candidato_nombre} ${app.candidato_apellido || ''}`.trim(),
      vacanteTitulo: app.vacante_titulo,
      empresaNombre: app.org_nombre,
      fechaInicio: params.fechaInicio,
      area: app.departamento,
      liderNombre,
      liderEmail,
      tipoContrato: app.tipo_contrato,
      salario: app.salario_ofrecido ? Number(app.salario_ofrecido) : undefined,
      moneda: app.moneda,
      modalidad: app.modalidad,
      ubicacion: app.ubicacion,
    }, params.variablesCustom);

    // 5. Create onboarding record
    const emailEstado = params.enviarEmailAhora ? 'pendiente' : 'programado';
    const onbResult = await client.query(
      `INSERT INTO onboarding (aplicacion_id, candidato_id, organization_id, fecha_inicio,
        email_bienvenida_estado, email_bienvenida_programado_at, variables_custom, notas_onboarding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        params.aplicacionId, app.candidato_id, params.orgId, params.fechaInicio,
        emailEstado,
        emailEstado === 'programado' ? new Date().toISOString() : null,
        JSON.stringify(params.variablesCustom || {}),
        params.notasOnboarding || null,
      ]
    );
    const onboarding = onbResult.rows[0];

    // 6. Activity log
    await client.query(
      `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
       VALUES ($1, 'aplicacion', $2, 'contratado', $3)`,
      [params.orgId, params.aplicacionId, JSON.stringify({
        candidato: `${app.candidato_nombre} ${app.candidato_apellido || ''}`.trim(),
        vacante: app.vacante_titulo,
        fecha_inicio: params.fechaInicio,
        email_estado: emailEstado,
      })]
    );

    await client.query('COMMIT');

    // 7. Send email if requested (outside transaction)
    if (params.enviarEmailAhora) {
      try {
        await enviarEmailBienvenida(onboarding.id, params.orgId);
      } catch (err) {
        console.error('[Onboarding] Error enviando email de bienvenida:', err);
      }
    }

    return onboarding;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ─── VARIABLES ────────────────────────────────

export function buildVariablesBienvenida(data: {
  candidatoNombre: string;
  vacanteTitulo: string;
  empresaNombre: string;
  fechaInicio: string;
  area?: string;
  liderNombre?: string;
  liderEmail?: string;
  tipoContrato?: string;
  salario?: number;
  moneda?: string;
  modalidad?: string;
  ubicacion?: string;
}, overrides?: Partial<VariablesBienvenida>): VariablesBienvenida {
  const formatFecha = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatSalario = (amount?: number, currency?: string) => {
    if (!amount) return 'Por definir';
    return `${currency || 'COP'} ${amount.toLocaleString('es-CO')}`;
  };

  const TIPO_CONTRATO_LABELS: Record<string, string> = {
    'prestacion_servicios': 'Prestación de servicios',
    'horas_demanda': 'Horas y demanda',
    'laboral': 'Contrato laboral',
    'termino_indefinido': 'Término indefinido',
    'termino_fijo': 'Término fijo',
    'obra_labor': 'Obra o labor',
  };

  const MODALIDAD_LABELS: Record<string, string> = {
    'remoto': 'Remoto',
    'hibrido': 'Híbrido',
    'presencial': 'Presencial',
  };

  const base: VariablesBienvenida = {
    nombre_empleado: data.candidatoNombre,
    cargo: data.vacanteTitulo,
    empresa: data.empresaNombre,
    fecha_inicio: formatFecha(data.fechaInicio),
    area: data.area || 'Por asignar',
    nombre_lider: data.liderNombre || 'Tu líder directo',
    email_lider: data.liderEmail || '',
    tipo_contrato: TIPO_CONTRATO_LABELS[data.tipoContrato || ''] || data.tipoContrato || 'Por definir',
    salario: formatSalario(data.salario, data.moneda),
    modalidad: MODALIDAD_LABELS[data.modalidad || ''] || data.modalidad || 'Por definir',
    ubicacion: data.ubicacion || 'Por definir',
  };

  return { ...base, ...overrides };
}

export function renderPlantilla(
  template: string,
  variables: VariablesBienvenida
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(regex, value || '');
  }
  return rendered;
}

// ─── EMAIL ────────────────────────────────────

export async function enviarEmailBienvenida(
  onboardingId: string,
  orgId: string
): Promise<boolean> {
  const result = await pool.query(
    `SELECT ob.*,
            c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
            v.titulo as vacante_titulo, v.departamento, v.modalidad, v.ubicacion,
            a.tipo_contrato, a.salario_ofrecido, a.moneda,
            o.name as org_nombre
     FROM onboarding ob
     JOIN aplicaciones a ON a.id = ob.aplicacion_id
     JOIN candidatos c ON c.id = ob.candidato_id
     JOIN vacantes v ON v.id = a.vacante_id
     JOIN organizations o ON o.id = ob.organization_id
     WHERE ob.id = $1 AND ob.organization_id = $2`,
    [onboardingId, orgId]
  );

  if (result.rows.length === 0) throw new Error('Onboarding no encontrado');
  const ob = result.rows[0];

  if (!ob.candidato_email) throw new Error('Candidato no tiene email');

  const config = await getOnboardingConfig(orgId);

  const customVars = typeof ob.variables_custom === 'string'
    ? JSON.parse(ob.variables_custom)
    : (ob.variables_custom || {});

  const variables = buildVariablesBienvenida({
    candidatoNombre: `${ob.candidato_nombre} ${ob.candidato_apellido || ''}`.trim(),
    vacanteTitulo: ob.vacante_titulo,
    empresaNombre: ob.org_nombre,
    fechaInicio: ob.fecha_inicio,
    area: ob.departamento,
    tipoContrato: ob.tipo_contrato,
    salario: ob.salario_ofrecido ? Number(ob.salario_ofrecido) : undefined,
    moneda: ob.moneda,
    modalidad: ob.modalidad,
    ubicacion: ob.ubicacion,
  }, customVars);

  const plantilla = config.plantilla_bienvenida || PLANTILLA_BIENVENIDA_DEFAULT;
  let htmlBody = renderPlantilla(plantilla, variables);

  // Append onboarding documents
  if (config.documentos_onboarding.length > 0) {
    const docsHtml = config.documentos_onboarding.map(d =>
      `<li style="margin: 8px 0;">
        <a href="${d.url}" style="color: #00BCD4; text-decoration: none; font-weight: 500;">${d.nombre}</a>
        ${d.descripcion ? `<br><span style="color: #6b7280; font-size: 13px;">${d.descripcion}</span>` : ''}
      </li>`
    ).join('');

    const docsSection = `
    <div style="background: #F0F9FF; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 560px;">
      <h3 style="color: #0A1F3F; margin-top: 0; font-size: 16px;">Documentos de onboarding</h3>
      <ul style="list-style: none; padding: 0; margin: 0;">${docsHtml}</ul>
    </div>`;

    const closingIdx = htmlBody.lastIndexOf('</div>');
    if (closingIdx > 0) {
      htmlBody = htmlBody.slice(0, closingIdx) + docsSection + htmlBody.slice(closingIdx);
    }
  }

  const asunto = config.asunto_bienvenida || ASUNTO_BIENVENIDA_DEFAULT;
  const subject = renderPlantilla(asunto, variables);
  const fromEmail = config.email_remitente || undefined;

  try {
    await sendEmail({
      to: ob.candidato_email,
      subject,
      htmlBody,
      from: fromEmail,
    });

    await pool.query(
      `UPDATE onboarding SET email_bienvenida_estado = 'enviado', email_bienvenida_enviado_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [onboardingId]
    );

    // Notificacion en tiempo real
    try {
      const candidatoNombreNotif = `${ob.candidato_nombre} ${ob.candidato_apellido || ''}`.trim();
      const notif = await crearNotificacion({
        organizacionId: orgId,
        tipo: 'onboarding_email_enviado',
        titulo: 'Email de onboarding enviado',
        mensaje: `Se envio email de bienvenida a ${candidatoNombreNotif}`,
        meta: { onboarding_id: onboardingId },
      });
      if (notif) {
        emitirNotificacion(orgId, {
          type: 'notificacion',
          id: notif.id,
          tipo: 'onboarding_email_enviado',
          titulo: 'Email de onboarding enviado',
          mensaje: `Se envio email de bienvenida a ${candidatoNombreNotif}`,
          browser_activo: notif.browser_activo,
          meta: { onboarding_id: onboardingId },
          created_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('[notificacion] Error:', e);
    }

    return true;
  } catch (error) {
    console.error('[Onboarding] Error sending welcome email:', error);
    await pool.query(
      `UPDATE onboarding SET email_bienvenida_estado = 'error', updated_at = NOW() WHERE id = $1`,
      [onboardingId]
    );
    return false;
  }
}

export async function procesarEmailsProgramados(): Promise<{ enviados: number; errores: number }> {
  const result = await pool.query(
    `SELECT ob.id, ob.organization_id
     FROM onboarding ob
     WHERE ob.fecha_inicio <= CURRENT_DATE AND ob.email_bienvenida_estado = 'programado'`
  );

  let enviados = 0;
  let errores = 0;

  for (const row of result.rows) {
    const ok = await enviarEmailBienvenida(row.id, row.organization_id);
    if (ok) enviados++;
    else errores++;
  }

  return { enviados, errores };
}

// ─── CRUD ─────────────────────────────────────

export async function listOnboardings(
  orgId: string,
  filters?: { estado?: string; vacanteId?: string }
): Promise<OnboardingCandidato[]> {
  let query = `
    SELECT ob.*,
           c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
           v.titulo as vacante_titulo, v.id as vacante_id
    FROM onboarding ob
    JOIN candidatos c ON c.id = ob.candidato_id
    JOIN aplicaciones a ON a.id = ob.aplicacion_id
    JOIN vacantes v ON v.id = a.vacante_id
    WHERE ob.organization_id = $1`;

  const params: unknown[] = [orgId];
  let idx = 2;

  if (filters?.estado) {
    query += ` AND ob.email_bienvenida_estado = $${idx++}`;
    params.push(filters.estado);
  }
  if (filters?.vacanteId) {
    query += ` AND v.id = $${idx++}`;
    params.push(filters.vacanteId);
  }

  query += ' ORDER BY ob.fecha_inicio DESC';

  const result = await pool.query(query, params);
  return result.rows;
}

export async function getOnboarding(
  onboardingId: string,
  orgId: string
): Promise<OnboardingCandidato | null> {
  const result = await pool.query(
    `SELECT ob.*,
            c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
            v.titulo as vacante_titulo, v.id as vacante_id
     FROM onboarding ob
     JOIN candidatos c ON c.id = ob.candidato_id
     JOIN aplicaciones a ON a.id = ob.aplicacion_id
     JOIN vacantes v ON v.id = a.vacante_id
     WHERE ob.id = $1 AND ob.organization_id = $2`,
    [onboardingId, orgId]
  );
  return result.rows[0] || null;
}

export async function getOnboardingByAplicacion(
  aplicacionId: string,
  orgId: string
): Promise<OnboardingCandidato | null> {
  const result = await pool.query(
    `SELECT ob.*,
            c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
            v.titulo as vacante_titulo, v.id as vacante_id
     FROM onboarding ob
     JOIN candidatos c ON c.id = ob.candidato_id
     JOIN aplicaciones a ON a.id = ob.aplicacion_id
     JOIN vacantes v ON v.id = a.vacante_id
     WHERE ob.aplicacion_id = $1 AND ob.organization_id = $2`,
    [aplicacionId, orgId]
  );
  return result.rows[0] || null;
}

export async function updateOnboarding(
  onboardingId: string,
  orgId: string,
  updates: {
    fechaInicio?: string;
    variablesCustom?: Partial<VariablesBienvenida>;
    notasOnboarding?: string;
  }
): Promise<void> {
  const fields: string[] = [];
  const params: unknown[] = [onboardingId, orgId];
  let idx = 3;

  if (updates.fechaInicio) {
    fields.push(`fecha_inicio = $${idx++}`);
    params.push(updates.fechaInicio);
  }
  if (updates.variablesCustom) {
    fields.push(`variables_custom = $${idx++}`);
    params.push(JSON.stringify(updates.variablesCustom));
  }
  if (updates.notasOnboarding !== undefined) {
    fields.push(`notas_onboarding = $${idx++}`);
    params.push(updates.notasOnboarding);
  }

  if (fields.length === 0) return;
  fields.push('updated_at = NOW()');

  await pool.query(
    `UPDATE onboarding SET ${fields.join(', ')} WHERE id = $1 AND organization_id = $2`,
    params
  );
}

// ─── ORG CONFIG ───────────────────────────────

export async function getOnboardingConfig(orgId: string): Promise<OnboardingConfig> {
  const settingsResult = await pool.query(
    `SELECT email_remitente, onboarding_plantilla, onboarding_asunto, onboarding_remitente_nombre
     FROM org_settings WHERE organization_id = $1`,
    [orgId]
  );

  const settings = settingsResult.rows[0] || {};

  const docsResult = await pool.query(
    `SELECT id, nombre, descripcion, url, tipo
     FROM documentos_onboarding
     WHERE organization_id = $1 AND is_active = true
     ORDER BY orden, created_at`,
    [orgId]
  );

  return {
    plantilla_bienvenida: settings.onboarding_plantilla || PLANTILLA_BIENVENIDA_DEFAULT,
    asunto_bienvenida: settings.onboarding_asunto || ASUNTO_BIENVENIDA_DEFAULT,
    email_remitente: settings.email_remitente || '',
    nombre_remitente: settings.onboarding_remitente_nombre || '',
    documentos_onboarding: docsResult.rows,
  };
}

export async function updateOnboardingConfig(
  orgId: string,
  config: Partial<OnboardingConfig>
): Promise<void> {
  const fields: string[] = [];
  const params: unknown[] = [orgId];
  let idx = 2;

  if (config.plantilla_bienvenida !== undefined) {
    fields.push(`onboarding_plantilla = $${idx++}`);
    params.push(config.plantilla_bienvenida);
  }
  if (config.asunto_bienvenida !== undefined) {
    fields.push(`onboarding_asunto = $${idx++}`);
    params.push(config.asunto_bienvenida);
  }
  if (config.email_remitente !== undefined) {
    fields.push(`email_remitente = $${idx++}`);
    params.push(config.email_remitente);
  }
  if (config.nombre_remitente !== undefined) {
    fields.push(`onboarding_remitente_nombre = $${idx++}`);
    params.push(config.nombre_remitente);
  }

  if (fields.length === 0) return;
  fields.push('updated_at = NOW()');

  const existing = await pool.query(
    `SELECT id FROM org_settings WHERE organization_id = $1`, [orgId]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE org_settings SET ${fields.join(', ')} WHERE organization_id = $1`,
      params
    );
  }
}

// ─── DOCUMENTOS ONBOARDING ORG ────────────────

export async function addDocumentoOnboarding(
  orgId: string,
  doc: { nombre: string; url: string; tipo: string; descripcion?: string }
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO documentos_onboarding (organization_id, nombre, url, tipo, descripcion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [orgId, doc.nombre, doc.url, doc.tipo, doc.descripcion || null]
  );
  return result.rows[0].id;
}

export async function removeDocumentoOnboarding(
  docId: string,
  orgId: string
): Promise<void> {
  await pool.query(
    `UPDATE documentos_onboarding SET is_active = false WHERE id = $1 AND organization_id = $2`,
    [docId, orgId]
  );
}

// ═══════════════════════════════════════════════
// LEGACY: Old onboarding status functions (backward compat)
// ═══════════════════════════════════════════════

interface OnboardingStatus {
  candidato_id: UUID;
  candidato_nombre: string;
  contrato_firmado: boolean;
  documentos: DocumentoCandidato[];
  documentos_requeridos: string[];
  documentos_completados: number;
  porcentaje_completado: number;
}

const DOCUMENTOS_REQUERIDOS = [
  'Documento de identidad',
  'Certificado bancario',
  'Certificado de EPS',
  'Certificado de AFP',
  'Foto',
  'Antecedentes',
];

export async function getOnboardingStatus(
  orgId: UUID,
  candidatoId: UUID
): Promise<OnboardingStatus> {
  const candidatoResult = await pool.query(
    'SELECT nombre, apellido FROM candidatos WHERE id = $1',
    [candidatoId]
  );
  if (candidatoResult.rows.length === 0) throw new NotFoundError('Candidato', candidatoId);

  const contratoResult = await pool.query(
    `SELECT estado FROM contratos WHERE candidato_id = $1 AND organization_id = $2
    ORDER BY created_at DESC LIMIT 1`,
    [candidatoId, orgId]
  );
  const contratoFirmado = contratoResult.rows[0]?.estado === 'firmado';

  const docsResult = await pool.query<DocumentoCandidato>(
    'SELECT * FROM documentos_candidato WHERE candidato_id = $1 ORDER BY created_at',
    [candidatoId]
  );

  const documentosCompletados = docsResult.rows.filter(d => d.verificado).length;
  const totalRequeridos = DOCUMENTOS_REQUERIDOS.length + 1;
  const completados = documentosCompletados + (contratoFirmado ? 1 : 0);

  return {
    candidato_id: candidatoId,
    candidato_nombre: `${candidatoResult.rows[0].nombre} ${candidatoResult.rows[0].apellido}`,
    contrato_firmado: contratoFirmado,
    documentos: docsResult.rows,
    documentos_requeridos: DOCUMENTOS_REQUERIDOS,
    documentos_completados: completados,
    porcentaje_completado: Math.round((completados / totalRequeridos) * 100),
  };
}

export async function uploadDocumento(
  orgId: UUID,
  candidatoId: UUID,
  tipo: string,
  nombre: string,
  url: string
): Promise<DocumentoCandidato> {
  const result = await pool.query<DocumentoCandidato>(
    `INSERT INTO documentos_candidato (organization_id, candidato_id, tipo, nombre, url)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [orgId, candidatoId, tipo, nombre, url]
  );
  return result.rows[0];
}
