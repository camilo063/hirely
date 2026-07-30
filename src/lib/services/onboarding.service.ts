import { pool } from '@/lib/db';
import { sendEmail } from './email.service';
import { crearNotificacion } from '@/lib/services/notificaciones.service';
import { UUID } from '@/lib/types/common.types';
import { NotFoundError } from '@/lib/utils/errors';
import { transicionarEstado } from './pipeline-transicion.service';
import { escaparHtml } from '@/lib/utils/escape-html';
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

    // El flujo real llega a la contratacion despues del portal de documentos
    // (seleccionado -> documentos_pendientes -> documentos_completos), no
    // directamente desde 'seleccionado'. Exigir solo 'seleccionado' hacia que
    // esta funcion lanzara siempre en el camino normal y el onboarding nunca
    // quedara registrado (el llamador se lo tragaba como error no bloqueante).
    const ESTADOS_CONTRATABLES = ['seleccionado', 'documentos_pendientes', 'documentos_completos'];
    if (!ESTADOS_CONTRATABLES.includes(app.estado) && app.estado !== 'contratado') {
      throw new Error(
        `Solo se puede contratar candidatos que ya fueron seleccionados. Estado actual: ${app.estado}`
      );
    }

    // 2. Update application to contratado
    await client.query(
      `UPDATE aplicaciones SET fecha_inicio_tentativa = $2, updated_at = NOW()
       WHERE id = $1`,
      [params.aplicacionId, params.fechaInicio]
    );
    await transicionarEstado(params.aplicacionId, 'contratado', {
      runner: client,
      orgId: params.orgId,
    });

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

/**
 * Crea (o actualiza, idempotente) el registro de onboarding cuando un candidato
 * pasa a "contratado". Se invoca desde el PATCH de estado de la aplicacion, de modo
 * que CUALQUIER via que lleve a contratado (boton Contratar o selector de estado)
 * genera el registro y gobierna el envio del email de bienvenida.
 *
 * envio:
 *   - 'ahora'      -> crea el registro y envia el email de inmediato
 *   - 'programado' -> crea el registro; el cron lo envia en la fecha de inicio
 *   - 'manual'     -> crea el registro sin enviar; el admin lo envia desde la lista
 */
export async function registrarOnboardingContratado(params: {
  aplicacionId: string;
  orgId: string;
  fechaInicio: string;
  liderId?: string | null;
  notasOnboarding?: string | null;
  envio: 'ahora' | 'programado' | 'manual';
}): Promise<{ onboardingId: string; emailEnviado: boolean }> {
  const appResult = await pool.query(
    `SELECT a.id, a.candidato_id, a.vacante_id, a.tipo_contrato,
            a.salario_ofrecido, a.moneda,
            v.titulo as vacante_titulo, v.departamento, v.modalidad, v.ubicacion
     FROM aplicaciones a
     JOIN vacantes v ON v.id = a.vacante_id
     WHERE a.id = $1 AND v.organization_id = $2`,
    [params.aplicacionId, params.orgId]
  );
  if (appResult.rows.length === 0) throw new Error('Aplicación no encontrada');
  const app = appResult.rows[0];

  // Guardar la fecha de inicio en la aplicacion
  await pool.query(
    `UPDATE aplicaciones SET fecha_inicio_tentativa = $2, updated_at = NOW() WHERE id = $1`,
    [params.aplicacionId, params.fechaInicio]
  );

  // Datos del lider (opcional) -> se guardan como variables_custom para el email
  let liderNombre: string | undefined;
  let liderEmail: string | undefined;
  if (params.liderId) {
    const liderResult = await pool.query(
      `SELECT name, email FROM users WHERE id = $1 AND organization_id = $2`,
      [params.liderId, params.orgId]
    );
    if (liderResult.rows.length > 0) {
      liderNombre = liderResult.rows[0].name;
      liderEmail = liderResult.rows[0].email;
    }
  }
  const variablesCustom: Record<string, string> = {};
  if (liderNombre) variablesCustom.nombre_lider = liderNombre;
  if (liderEmail) variablesCustom.email_lider = liderEmail;

  const emailEstado = params.envio === 'programado' ? 'programado' : 'pendiente';

  // Upsert: 1:1 con la aplicacion (UNIQUE en aplicacion_id)
  const onbResult = await pool.query(
    `INSERT INTO onboarding (aplicacion_id, candidato_id, organization_id, fecha_inicio,
       email_bienvenida_estado, email_bienvenida_programado_at, variables_custom, notas_onboarding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (aplicacion_id) DO UPDATE SET
       fecha_inicio = EXCLUDED.fecha_inicio,
       variables_custom = EXCLUDED.variables_custom,
       notas_onboarding = COALESCE(EXCLUDED.notas_onboarding, onboarding.notas_onboarding),
       updated_at = NOW()
     RETURNING *`,
    [
      params.aplicacionId, app.candidato_id, params.orgId, params.fechaInicio,
      emailEstado,
      params.envio === 'programado' ? new Date().toISOString() : null,
      JSON.stringify(variablesCustom),
      params.notasOnboarding || null,
    ]
  );
  const onboarding = onbResult.rows[0];

  let emailEnviado = false;
  if (params.envio === 'ahora') {
    try {
      emailEnviado = await enviarEmailBienvenida(onboarding.id, params.orgId);
    } catch (err) {
      console.error('[Onboarding] Error enviando email de bienvenida:', err);
    }
  }

  return { onboardingId: onboarding.id, emailEnviado };
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
    'indefinido': 'Término indefinido',
    'termino_fijo': 'Término fijo',
    'prestacion_servicios': 'Prestación de servicios',
    'obra_labor': 'Obra o labor',
    'aprendizaje': 'Aprendizaje',
    'horas_demanda': 'Horas y demanda',
    'laboral': 'Contrato laboral',
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

/**
 * Sustituye los marcadores {{variable}} de la plantilla de bienvenida.
 *
 * @param escaparValores  Debe ser `true` cuando el resultado se inserta en HTML
 *   (el cuerpo del correo) y `false` cuando es texto plano (el asunto). Sin esta
 *   distincion, `candidato_nombre` —que viene del formulario publico de
 *   postulacion— se interpolaba crudo en el HTML del correo de bienvenida:
 *   quien se postulaba podia inyectar enlaces o reescribir el cuerpo de un
 *   correo firmado con la marca del cliente. `sustituirVariables`
 *   (email-templates.ts) ya sigue este mismo criterio.
 */
export function renderPlantilla(
  template: string,
  variables: VariablesBienvenida,
  escaparValores = false
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    const valor = value || '';
    rendered = rendered.replace(regex, escaparValores ? escaparHtml(String(valor)) : String(valor));
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
     JOIN candidatos c ON c.id = ob.candidato_id AND c.organization_id = ob.organization_id
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
  // Los documentos de onboarding se colocan manualmente en el cuerpo de la plantilla
  // (via el link estable copiable de Configuracion > Onboarding), no se auto-anexan.
  const htmlBody = renderPlantilla(plantilla, variables, true);

  const asunto = config.asunto_bienvenida || ASUNTO_BIENVENIDA_DEFAULT;
  // El asunto es texto plano: aqui NO se escapa (mostraria "Perez &amp; Cia").
  const subject = renderPlantilla(asunto, variables);
  const fromEmail = config.email_remitente || undefined;
  const fromName = config.nombre_remitente || undefined;

  try {
    // `sendEmail` devuelve false (no lanza) cuando el proveedor rechaza el
    // envio. Ignorar ese booleano marcaba el onboarding como 'enviado' aunque
    // Resend hubiera respondido un error, y la API contestaba "Email enviado
    // correctamente": el reclutador daba por avisado a un candidato que nunca
    // recibio nada.
    const enviado = await sendEmail({
      to: ob.candidato_email,
      subject,
      htmlBody,
      from: fromEmail,
      fromName,
    });

    if (!enviado) {
      await pool.query(
        `UPDATE onboarding SET email_bienvenida_estado = 'error', updated_at = NOW() WHERE id = $1`,
        [onboardingId]
      );
      console.error(`[Onboarding] El proveedor rechazo el email de bienvenida (onboarding ${onboardingId})`);
      return false;
    }

    await pool.query(
      `UPDATE onboarding SET email_bienvenida_estado = 'enviado', email_bienvenida_enviado_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [onboardingId]
    );

    // Notificacion en tiempo real
    try {
      const candidatoNombreNotif = `${ob.candidato_nombre} ${ob.candidato_apellido || ''}`.trim();
      await crearNotificacion({
        organizacionId: orgId,
        tipo: 'onboarding_email_enviado',
        titulo: 'Email de onboarding enviado',
        mensaje: `Se envio email de bienvenida a ${candidatoNombreNotif}`,
        meta: { onboarding_id: onboardingId },
      });
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

/**
 * Envia los correos de bienvenida programados que ya tocan.
 *
 * @param orgId Si se indica, procesa SOLO esa organizacion. El cron real (que se
 *   autentica con CRON_SECRET) lo omite para barrer todas; un disparo manual
 *   desde el panel debe pasar el suyo. Sin este parametro, cualquier usuario
 *   autenticado de cualquier empresa forzaba el envio anticipado de los correos
 *   de TODAS las organizaciones y mutaba sus filas.
 */
export async function procesarEmailsProgramados(
  orgId?: string
): Promise<{ enviados: number; errores: number }> {
  const result = await pool.query(
    `SELECT ob.id, ob.organization_id
     FROM onboarding ob
     WHERE ob.fecha_inicio <= CURRENT_DATE
       AND ob.email_bienvenida_estado = 'programado'
       AND ($1::uuid IS NULL OR ob.organization_id = $1)`,
    [orgId ?? null]
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
  filters?: { estado?: string; vacanteId?: string; aplicacionId?: string }
): Promise<OnboardingCandidato[]> {
  let query = `
    SELECT ob.*,
           c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
           v.titulo as vacante_titulo, v.id as vacante_id
    FROM onboarding ob
    JOIN candidatos c ON c.id = ob.candidato_id AND c.organization_id = ob.organization_id
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
  if (filters?.aplicacionId) {
    query += ` AND ob.aplicacion_id = $${idx++}`;
    params.push(filters.aplicacionId);
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
     JOIN candidatos c ON c.id = ob.candidato_id AND c.organization_id = ob.organization_id
     JOIN aplicaciones a ON a.id = ob.aplicacion_id
     JOIN vacantes v ON v.id = a.vacante_id
     WHERE ob.id = $1 AND ob.organization_id = $2`,
    [onboardingId, orgId]
  );
  // Devolver `null` hacia que el route reventara con 500 al leer los campos.
  // Un id inexistente o de otra organizacion es un 404.
  if (result.rows.length === 0) throw new NotFoundError('Onboarding', onboardingId);
  return result.rows[0];
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
     JOIN candidatos c ON c.id = ob.candidato_id AND c.organization_id = ob.organization_id
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
  const columnas: string[] = [];
  const params: unknown[] = [orgId];

  const mapa: [keyof OnboardingConfig, string][] = [
    ['plantilla_bienvenida', 'onboarding_plantilla'],
    ['asunto_bienvenida', 'onboarding_asunto'],
    ['email_remitente', 'email_remitente'],
    ['nombre_remitente', 'onboarding_remitente_nombre'],
  ];

  for (const [clave, columna] of mapa) {
    if (config[clave] !== undefined) {
      columnas.push(columna);
      params.push(config[clave]);
    }
  }

  if (columnas.length === 0) return;

  // Upsert real, con las columnas presentes generadas dinamicamente (igual que
  // `configuracion/emails/route.ts`). Antes se hacia un `UPDATE` a secas: si la
  // organizacion aun no tenia fila en `org_settings` (comun — esa fila solo se
  // crea la primera vez que alguien guarda CUALQUIER configuracion), el UPDATE
  // no afectaba nada y la API respondia 200 sin haber guardado nada. Los otros
  // 3 escritores de esta tabla (emails, scoring, checklist) ya hacian upsert.
  const placeholders = columnas.map((_, i) => `$${i + 2}`);
  const sets = columnas.map((c, i) => `${c} = $${i + 2}`);

  await pool.query(
    `INSERT INTO org_settings (organization_id, ${columnas.join(', ')})
     VALUES ($1, ${placeholders.join(', ')})
     ON CONFLICT (organization_id) DO UPDATE SET ${sets.join(', ')}, updated_at = NOW()`,
    params
  );
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
  const resultado = await pool.query(
    `UPDATE documentos_onboarding SET is_active = false WHERE id = $1 AND organization_id = $2`,
    [docId, orgId]
  );
  // Sin comprobar rowCount, borrar un id inexistente o de otra org
  // respondia exito igual.
  if (resultado.rowCount === 0) throw new NotFoundError('Documento de onboarding', docId);
}
