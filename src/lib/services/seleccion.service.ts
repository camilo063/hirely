/**
 * Selection & Documents service.
 * Handles candidate selection, rejection, document checklist, and verification.
 */

import { pool } from '@/lib/db';
import { getAppUrl } from '@/lib/utils/url';
import { sendEmail } from './email.service';
import { crearNotificacion } from '@/lib/services/notificaciones.service';
import { emitirNotificacion } from '@/lib/services/sse-clients';
import {
  emailSeleccionTemplate,
  emailRechazoTemplate,
  emailDocumentosCompletosTemplate,
  emailDocumentoRechazadoTemplate,
  DEFAULT_TEMPLATE_SELECCION,
  DEFAULT_TEMPLATE_RECHAZO,
  sustituirVariables,
} from '@/lib/utils/email-templates';
import { randomBytes } from 'crypto';
import { NotFoundError, ValidationError } from '@/lib/utils/errors';
import type {
  SeleccionPayload,
  RechazoPayload,
  DocumentoChecklist,
  DocumentoCandidatoRow,
  DocumentoConLabel,
} from '@/lib/types/seleccion.types';
import { CHECKLIST_DOCUMENTOS_DEFAULT } from '@/lib/types/seleccion.types';

// ─── SELECCIÓN ────────────────────────────────

export async function seleccionarCandidato(
  payload: SeleccionPayload,
  orgId: string,
  userId: string
): Promise<{ portalUrl: string; portalToken: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify aplicacion exists and belongs to org
    const appResult = await client.query(
      `SELECT a.*, c.nombre as candidato_nombre, c.apellido as candidato_apellido,
              c.email as candidato_email, c.id as cand_id,
              v.titulo as vacante_titulo, v.checklist_documentos as vacante_checklist,
              o.name as org_nombre
       FROM aplicaciones a
       JOIN candidatos c ON c.id = a.candidato_id
       JOIN vacantes v ON v.id = a.vacante_id
       JOIN organizations o ON o.id = v.organization_id
       WHERE a.id = $1 AND v.organization_id = $2`,
      [payload.aplicacion_id, orgId]
    );
    if (appResult.rows.length === 0) throw new NotFoundError('Aplicacion', payload.aplicacion_id);
    const app = appResult.rows[0];

    // 2. Update estado to seleccionado + save selection data
    await client.query(
      `UPDATE aplicaciones SET
        estado = 'seleccionado',
        seleccionado_at = NOW(),
        tipo_contrato = $2,
        fecha_inicio_tentativa = $3,
        salario_ofrecido = $4,
        moneda = $5,
        updated_at = NOW()
       WHERE id = $1`,
      [
        payload.aplicacion_id,
        payload.tipo_contrato || null,
        payload.fecha_inicio_tentativa || null,
        payload.salario_ofrecido || null,
        payload.moneda || 'COP',
      ]
    );

    // 3. Generate portal token
    const portalToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await client.query(
      `INSERT INTO portal_tokens (aplicacion_id, token, expires_at) VALUES ($1, $2, $3)`,
      [payload.aplicacion_id, portalToken, expiresAt]
    );

    await client.query(
      `UPDATE aplicaciones SET portal_token = $2 WHERE id = $1`,
      [payload.aplicacion_id, portalToken]
    );

    // 4. Get checklist (vacante > org_settings > default)
    let checklist: DocumentoChecklist[] = await getEffectiveChecklist(
      orgId,
      app.vacante_checklist,
      client
    );

    // Filter by tipo_contrato if set
    if (payload.tipo_contrato) {
      checklist = checklist.filter(
        d => !d.aplica_para || d.aplica_para.length === 0 || d.aplica_para.includes(payload.tipo_contrato!)
      );
    }

    // 5. Create documento records
    for (const doc of checklist) {
      await client.query(
        `INSERT INTO documentos_candidato (aplicacion_id, tipo, nombre_archivo, url, estado)
         VALUES ($1, $2, $3, '', 'pendiente')`,
        [payload.aplicacion_id, doc.tipo, doc.label]
      );
    }

    // 6. Log activity
    await client.query(
      `INSERT INTO activity_log (organization_id, user_id, entity_type, entity_id, action, details)
       VALUES ($1, $2, 'aplicacion', $3, 'seleccionado', $4)`,
      [orgId, userId, payload.aplicacion_id, JSON.stringify({
        candidato: `${app.candidato_nombre} ${app.candidato_apellido}`,
        vacante: app.vacante_titulo,
        tipo_contrato: payload.tipo_contrato,
      })]
    );

    await client.query('COMMIT');

    // 7. Send selection email (outside transaction)
    const baseUrl = getAppUrl();
    const portalUrl = `${baseUrl}/portal/documentos/${portalToken}`;

    if (payload.enviar_email_seleccion && app.candidato_email) {
      try {
        const candidatoNombre = `${app.candidato_nombre} ${app.candidato_apellido || ''}`.trim();
        const docsRequeridos = checklist
          .filter(d => d.requerido)
          .map(d => ({ label: d.label, descripcion: d.descripcion }));
        const salarioStr = payload.salario_ofrecido
          ? `${new Intl.NumberFormat('es-CO').format(payload.salario_ofrecido)} ${payload.moneda || 'COP'}`
          : '';
        const fechaLimiteDocs = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

        // Check if org has a custom template in org_settings
        const { rows: settingsRows } = await pool.query(
          `SELECT email_seleccion_body FROM org_settings WHERE organization_id = $1`,
          [orgId]
        );
        const customTemplate = settingsRows[0]?.email_seleccion_body;

        if (customTemplate) {
          // Use custom template with variable substitution
          const variables: Record<string, string> = {
            candidato_nombre: candidatoNombre,
            vacante_titulo: app.vacante_titulo,
            empresa_nombre: app.org_nombre,
            portal_url: portalUrl,
            documentos_requeridos: docsRequeridos.map(d => d.label).join(', '),
            fecha_limite_docs: fechaLimiteDocs,
            fecha_inicio: payload.fecha_inicio_tentativa || '',
            salario: salarioStr,
          };
          const htmlBody = sustituirVariables(customTemplate, variables);

          await sendEmail({
            to: app.candidato_email,
            subject: `Felicidades! Has sido seleccionado(a) para ${app.vacante_titulo}`,
            htmlBody,
            textBody: `Felicidades ${candidatoNombre}! Has sido seleccionado(a) para ${app.vacante_titulo} en ${app.org_nombre}. Sube tus documentos aqui: ${portalUrl}`,
          });
        } else {
          // Fallback to built-in template function
          const emailData = emailSeleccionTemplate({
            candidatoNombre,
            vacanteTitulo: app.vacante_titulo,
            empresaNombre: app.org_nombre,
            portalUrl,
            documentosRequeridos: docsRequeridos,
            mensajePersonalizado: payload.mensaje_personalizado,
            fechaInicio: payload.fecha_inicio_tentativa,
            salario: salarioStr || undefined,
          });

          await sendEmail({
            to: app.candidato_email,
            subject: emailData.subject,
            htmlBody: emailData.htmlBody,
            textBody: emailData.textBody,
          });
        }
      } catch (emailError) {
        console.error('[Seleccion] Error enviando email de seleccion:', emailError);
      }
    }

    return { portalUrl, portalToken };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ─── RECHAZO ──────────────────────────────────

export async function rechazarCandidatos(
  payload: RechazoPayload,
  orgId: string,
  userId: string
): Promise<{ enviados: number; errores: number }> {
  let enviados = 0;
  let errores = 0;

  for (const aplicacionId of payload.aplicacion_ids) {
    try {
      const result = await pool.query(
        `SELECT a.*, c.nombre as candidato_nombre, c.apellido as candidato_apellido,
                c.email as candidato_email,
                v.titulo as vacante_titulo, o.name as org_nombre
         FROM aplicaciones a
         JOIN candidatos c ON c.id = a.candidato_id
         JOIN vacantes v ON v.id = a.vacante_id
         JOIN organizations o ON o.id = v.organization_id
         WHERE a.id = $1 AND v.organization_id = $2`,
        [aplicacionId, orgId]
      );
      if (result.rows.length === 0) { errores++; continue; }
      const app = result.rows[0];

      await pool.query(
        `UPDATE aplicaciones SET estado = 'descartado', motivo_descarte = $2, updated_at = NOW()
         WHERE id = $1`,
        [aplicacionId, payload.mensaje_personalizado || 'No seleccionado']
      );

      // Log activity
      await pool.query(
        `INSERT INTO activity_log (organization_id, user_id, entity_type, entity_id, action, details)
         VALUES ($1, $2, 'aplicacion', $3, 'descartado', $4)`,
        [orgId, userId, aplicacionId, JSON.stringify({
          candidato: `${app.candidato_nombre} ${app.candidato_apellido}`,
          vacante: app.vacante_titulo,
        })]
      );

      if (payload.enviar_email_rechazo && app.candidato_email) {
        try {
          const candidatoNombre = `${app.candidato_nombre} ${app.candidato_apellido || ''}`.trim();

          // Check if org has a custom rejection template
          const { rows: settingsRows } = await pool.query(
            `SELECT email_rechazo_body FROM org_settings WHERE organization_id = $1`,
            [orgId]
          );
          const customTemplate = settingsRows[0]?.email_rechazo_body;

          if (customTemplate) {
            const variables: Record<string, string> = {
              candidato_nombre: candidatoNombre,
              vacante_titulo: app.vacante_titulo,
              empresa_nombre: app.org_nombre,
            };
            const htmlBody = sustituirVariables(customTemplate, variables);

            await sendEmail({
              to: app.candidato_email,
              subject: `Gracias por tu interes en ${app.vacante_titulo} — ${app.org_nombre}`,
              htmlBody,
              textBody: `Estimado/a ${candidatoNombre}, agradecemos tu interes en ${app.vacante_titulo} en ${app.org_nombre}. Lamentablemente hemos decidido continuar con otros candidatos.`,
            });
          } else {
            const emailData = emailRechazoTemplate({
              candidatoNombre,
              vacanteTitulo: app.vacante_titulo,
              empresaNombre: app.org_nombre,
              mensajePersonalizado: payload.mensaje_personalizado,
            });

            await sendEmail({
              to: app.candidato_email,
              subject: emailData.subject,
              htmlBody: emailData.htmlBody,
              textBody: emailData.textBody,
            });
          }
        } catch (emailError) {
          console.error('[Seleccion] Error enviando email de rechazo:', emailError);
        }
      }

      enviados++;
    } catch (error) {
      console.error(`Error rechazando aplicacion ${aplicacionId}:`, error);
      errores++;
    }
  }

  return { enviados, errores };
}

// ─── DOCUMENTOS ───────────────────────────────

export async function getChecklistDocumentos(
  aplicacionId: string,
  orgId: string
): Promise<{ documentos: DocumentoConLabel[]; completo: boolean; portalUrl: string | null }> {
  // Verify ownership
  const appResult = await pool.query(
    `SELECT a.portal_token, v.checklist_documentos as vacante_checklist
     FROM aplicaciones a
     JOIN vacantes v ON v.id = a.vacante_id
     WHERE a.id = $1 AND v.organization_id = $2`,
    [aplicacionId, orgId]
  );
  if (appResult.rows.length === 0) throw new NotFoundError('Aplicacion', aplicacionId);

  const docs = await pool.query<DocumentoCandidatoRow>(
    `SELECT * FROM documentos_candidato WHERE aplicacion_id = $1 ORDER BY created_at`,
    [aplicacionId]
  );

  // Get checklist config for labels
  const checklist = await getEffectiveChecklist(orgId, appResult.rows[0].vacante_checklist);
  const checklistMap = new Map(checklist.map(c => [c.tipo, c]));

  const documentos: DocumentoConLabel[] = docs.rows.map(doc => {
    const config = checklistMap.get(doc.tipo);
    return {
      ...doc,
      label: config?.label || doc.nombre_archivo || doc.tipo,
      descripcion: config?.descripcion,
      requerido: config?.requerido ?? false,
    };
  });

  // Check completeness: all required docs must be 'subido' or 'verificado'
  const requeridosFaltantes = documentos.filter(
    d => d.requerido && d.estado !== 'subido' && d.estado !== 'verificado'
  );
  const completo = requeridosFaltantes.length === 0 && documentos.length > 0;

  const portalToken = appResult.rows[0].portal_token;
  const baseUrl = getAppUrl();
  const portalUrl = portalToken ? `${baseUrl}/portal/documentos/${portalToken}` : null;

  return { documentos, completo, portalUrl };
}

export async function verificarDocumento(
  documentoId: string,
  orgId: string,
  userId: string,
  accion: 'verificar' | 'rechazar',
  notaRechazo?: string
): Promise<void> {
  // Verify ownership — include candidate + vacancy info for rejection email
  const docResult = await pool.query(
    `SELECT dc.*, a.id as app_id, a.portal_token,
            c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
            v.titulo as vacante_titulo, o.name as org_nombre
     FROM documentos_candidato dc
     JOIN aplicaciones a ON a.id = dc.aplicacion_id
     JOIN vacantes v ON v.id = a.vacante_id
     JOIN organizations o ON o.id = v.organization_id
     JOIN candidatos c ON c.id = a.candidato_id
     WHERE dc.id = $1 AND v.organization_id = $2`,
    [documentoId, orgId]
  );
  if (docResult.rows.length === 0) throw new NotFoundError('Documento', documentoId);

  const doc = docResult.rows[0];
  const newEstado = accion === 'verificar' ? 'verificado' : 'rechazado';

  await pool.query(
    `UPDATE documentos_candidato SET
      estado = $2,
      nota_rechazo = $3,
      verificado_por = $4,
      verificado_at = NOW()
     WHERE id = $1`,
    [documentoId, newEstado, accion === 'rechazar' ? notaRechazo : null, userId]
  );

  // Check if all required docs are verified
  const aplicacionId = doc.app_id;
  await checkDocumentosCompleteness(aplicacionId, orgId);

  // Log activity
  await pool.query(
    `INSERT INTO activity_log (organization_id, user_id, entity_type, entity_id, action, details)
     VALUES ($1, $2, 'documento', $3, $4, $5)`,
    [orgId, userId, documentoId, accion, JSON.stringify({
      documento_tipo: doc.tipo,
      nota_rechazo: notaRechazo,
    })]
  );

  // S7b: Send rejection email to candidate
  if (accion === 'rechazar' && doc.candidato_email) {
    try {
      const baseUrl = getAppUrl();
      const portalUrl = doc.portal_token
        ? `${baseUrl}/portal/documentos/${doc.portal_token}`
        : baseUrl;

      const candidatoNombre = `${doc.candidato_nombre} ${doc.candidato_apellido || ''}`.trim();
      const emailData = emailDocumentoRechazadoTemplate({
        candidatoNombre,
        empresaNombre: doc.org_nombre,
        vacanteTitulo: doc.vacante_titulo,
        documentoTipo: doc.nombre_archivo || doc.tipo,
        motivoRechazo: notaRechazo || 'No se especifico un motivo',
        portalUrl,
      });

      await sendEmail({
        to: doc.candidato_email,
        subject: emailData.subject,
        htmlBody: emailData.htmlBody,
        textBody: emailData.textBody,
      });
    } catch (emailError) {
      // Rejection must succeed even if email fails
      console.error('[Seleccion] Error enviando email de documento rechazado:', emailError);
    }
  }
}

async function checkDocumentosCompleteness(aplicacionId: string, orgId: string): Promise<void> {
  const checklist = await getChecklistDocumentos(aplicacionId, orgId);

  if (checklist.completo) {
    // Check if all required are specifically verified (not just uploaded)
    const allVerified = checklist.documentos
      .filter(d => d.requerido)
      .every(d => d.estado === 'verificado');

    await pool.query(
      `UPDATE aplicaciones SET documentos_completos = $2, updated_at = NOW() WHERE id = $1`,
      [aplicacionId, allVerified]
    );
  }
}

// ─── PORTAL (PUBLIC) ──────────────────────────

export async function getPortalData(token: string) {
  // Validate token
  const tokenResult = await pool.query(
    `SELECT pt.*, a.candidato_id, a.tipo_contrato
     FROM portal_tokens pt
     JOIN aplicaciones a ON a.id = pt.aplicacion_id
     WHERE pt.token = $1`,
    [token]
  );
  if (tokenResult.rows.length === 0) return null;

  const tokenRow = tokenResult.rows[0];
  const isExpired = new Date(tokenRow.expires_at) < new Date();

  if (isExpired) {
    return { token_valid: false, expired: true };
  }

  // Increment used_count
  await pool.query(
    `UPDATE portal_tokens SET used_count = used_count + 1 WHERE id = $1`,
    [tokenRow.id]
  );

  // Get candidate, vacancy, org data
  const dataResult = await pool.query(
    `SELECT c.nombre as candidato_nombre, c.apellido as candidato_apellido,
            v.titulo as vacante_titulo, v.checklist_documentos as vacante_checklist,
            o.name as org_nombre, o.id as org_id
     FROM aplicaciones a
     JOIN candidatos c ON c.id = a.candidato_id
     JOIN vacantes v ON v.id = a.vacante_id
     JOIN organizations o ON o.id = v.organization_id
     WHERE a.id = $1`,
    [tokenRow.aplicacion_id]
  );
  if (dataResult.rows.length === 0) return null;
  const data = dataResult.rows[0];

  // Get documents
  const docs = await pool.query<DocumentoCandidatoRow>(
    `SELECT * FROM documentos_candidato WHERE aplicacion_id = $1 ORDER BY created_at`,
    [tokenRow.aplicacion_id]
  );

  // Get checklist config for labels
  const checklist = await getEffectiveChecklist(data.org_id, data.vacante_checklist);
  const checklistMap = new Map(checklist.map(c => [c.tipo, c]));

  const documentos: DocumentoConLabel[] = docs.rows.map(doc => {
    const config = checklistMap.get(doc.tipo);
    return {
      ...doc,
      label: config?.label || doc.nombre_archivo || doc.tipo,
      descripcion: config?.descripcion,
      requerido: config?.requerido ?? false,
    };
  });

  const subidos = documentos.filter(d => d.estado === 'subido' || d.estado === 'verificado').length;
  const verificados = documentos.filter(d => d.estado === 'verificado').length;
  const requeridosFaltantes = documentos.filter(
    d => d.requerido && d.estado !== 'subido' && d.estado !== 'verificado'
  ).length;

  return {
    aplicacion_id: tokenRow.aplicacion_id,
    candidato: { nombre: `${data.candidato_nombre} ${data.candidato_apellido || ''}`.trim() },
    vacante: { titulo: data.vacante_titulo },
    empresa: { nombre: data.org_nombre },
    documentos,
    progreso: {
      total: documentos.length,
      subidos,
      verificados,
      requeridos_faltantes: requeridosFaltantes,
    },
    completo: requeridosFaltantes === 0 && documentos.length > 0,
    token_valid: true,
    expires_at: tokenRow.expires_at,
  };
}

export async function uploadDocumentoPortal(
  token: string,
  documentoId: string,
  tipo: string,
  nombreArchivo: string,
  url: string
): Promise<{ success: boolean }> {
  // Validate token
  const tokenResult = await pool.query(
    `SELECT pt.aplicacion_id FROM portal_tokens pt WHERE pt.token = $1 AND pt.expires_at > NOW()`,
    [token]
  );
  if (tokenResult.rows.length === 0) {
    throw new ValidationError('Token invalido o expirado');
  }
  const aplicacionId = tokenResult.rows[0].aplicacion_id;

  // Update document
  const result = await pool.query(
    `UPDATE documentos_candidato SET
      nombre_archivo = $3,
      url = $4,
      estado = 'subido',
      nota_rechazo = NULL
     WHERE id = $1 AND aplicacion_id = $2
     RETURNING *`,
    [documentoId, aplicacionId, nombreArchivo, url]
  );

  if (result.rows.length === 0) {
    // Maybe the doc doesn't exist by ID, try by tipo
    const byTipo = await pool.query(
      `UPDATE documentos_candidato SET
        nombre_archivo = $3,
        url = $4,
        estado = 'subido',
        nota_rechazo = NULL
       WHERE tipo = $1 AND aplicacion_id = $2
       RETURNING *`,
      [tipo, aplicacionId, nombreArchivo, url]
    );
    if (byTipo.rows.length === 0) {
      throw new NotFoundError('Documento', documentoId);
    }
  }

  // Notificacion: documento subido
  try {
    const appDataNotif = await pool.query(
      `SELECT v.organization_id FROM aplicaciones a JOIN vacantes v ON v.id = a.vacante_id WHERE a.id = $1`,
      [aplicacionId]
    );
    const orgIdNotif = appDataNotif.rows[0]?.organization_id;
    if (orgIdNotif) {
      const notif = await crearNotificacion({
        organizacionId: orgIdNotif,
        tipo: 'documento_subido',
        titulo: 'Documento subido',
        mensaje: `${tipo} subido por candidato`,
        meta: { aplicacion_id: aplicacionId },
      });
      if (notif) {
        emitirNotificacion(orgIdNotif, {
          type: 'notificacion',
          id: notif.id,
          tipo: 'documento_subido',
          titulo: 'Documento subido',
          mensaje: `${tipo} subido por candidato`,
          browser_activo: notif.browser_activo,
          meta: { aplicacion_id: aplicacionId },
          created_at: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error('[notificacion] Error:', e);
  }

  // Check if all required docs are now uploaded
  const docs = await pool.query(
    `SELECT * FROM documentos_candidato WHERE aplicacion_id = $1`,
    [aplicacionId]
  );

  // Get org_id for checklist lookup
  const appData = await pool.query(
    `SELECT v.organization_id, v.checklist_documentos
     FROM aplicaciones a JOIN vacantes v ON v.id = a.vacante_id
     WHERE a.id = $1`,
    [aplicacionId]
  );
  const orgId = appData.rows[0]?.organization_id;
  const vacanteChecklist = appData.rows[0]?.checklist_documentos;

  const checklist = await getEffectiveChecklist(orgId, vacanteChecklist);
  const checklistMap = new Map(checklist.map(c => [c.tipo, c]));

  const allRequiredUploaded = docs.rows.every((doc: DocumentoCandidatoRow) => {
    const config = checklistMap.get(doc.tipo);
    if (!config?.requerido) return true;
    return doc.estado === 'subido' || doc.estado === 'verificado';
  });

  if (allRequiredUploaded) {
    await pool.query(
      `UPDATE aplicaciones SET documentos_completos = true, updated_at = NOW() WHERE id = $1`,
      [aplicacionId]
    );

    // Notify recruiter
    await notifyDocumentosCompletos(aplicacionId);

    // Notificacion: documentos completos
    try {
      if (orgId) {
        const candInfo = await pool.query(
          `SELECT c.nombre as candidato_nombre, c.apellido as candidato_apellido, a.vacante_id
           FROM aplicaciones a JOIN candidatos c ON c.id = a.candidato_id
           WHERE a.id = $1`,
          [aplicacionId]
        );
        const candNombre = candInfo.rows.length > 0
          ? `${candInfo.rows[0].candidato_nombre} ${candInfo.rows[0].candidato_apellido || ''}`.trim()
          : 'Candidato';
        const vacanteIdNotif = candInfo.rows[0]?.vacante_id;
        const notif = await crearNotificacion({
          organizacionId: orgId,
          tipo: 'documentos_completos',
          titulo: 'Documentos completos',
          mensaje: `${candNombre} completo todos los documentos`,
          meta: { aplicacion_id: aplicacionId, url: `/vacantes/${vacanteIdNotif}/candidatos` },
        });
        if (notif) {
          emitirNotificacion(orgId, {
            type: 'notificacion',
            id: notif.id,
            tipo: 'documentos_completos',
            titulo: 'Documentos completos',
            mensaje: `${candNombre} completo todos los documentos`,
            browser_activo: notif.browser_activo,
            meta: { aplicacion_id: aplicacionId, url: `/vacantes/${vacanteIdNotif}/candidatos` },
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.error('[notificacion] Error:', e);
    }
  }

  return { success: true };
}

async function notifyDocumentosCompletos(aplicacionId: string): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT c.nombre as candidato_nombre, c.apellido as candidato_apellido,
              v.titulo as vacante_titulo, v.organization_id,
              u.email as recruiter_email, u.name as recruiter_nombre
       FROM aplicaciones a
       JOIN candidatos c ON c.id = a.candidato_id
       JOIN vacantes v ON v.id = a.vacante_id
       JOIN users u ON u.organization_id = v.organization_id AND u.role IN ('admin', 'reclutador')
       WHERE a.id = $1
       LIMIT 1`,
      [aplicacionId]
    );

    if (result.rows.length === 0) return;
    const data = result.rows[0];

    const baseUrl = getAppUrl();
    const emailData = emailDocumentosCompletosTemplate({
      reclutadorNombre: data.recruiter_nombre || 'Reclutador',
      candidatoNombre: `${data.candidato_nombre} ${data.candidato_apellido || ''}`.trim(),
      vacanteTitulo: data.vacante_titulo,
      dashboardUrl: `${baseUrl}/vacantes`,
    });

    await sendEmail({
      to: data.recruiter_email,
      subject: emailData.subject,
      htmlBody: emailData.htmlBody,
      textBody: emailData.textBody,
    });
  } catch (error) {
    console.error('[Seleccion] Error notificando documentos completos:', error);
  }
}

// ─── ORG CHECKLIST CONFIG ─────────────────────

export async function getOrgChecklist(
  orgId: string,
  client?: { query: typeof pool.query }
): Promise<DocumentoChecklist[]> {
  const runner = client ?? pool;
  const result = await runner.query(
    `SELECT checklist_documentos FROM org_settings WHERE organization_id = $1`,
    [orgId]
  );
  const parsed = parseChecklistJson(result.rows[0]?.checklist_documentos);
  if (parsed.length > 0) return parsed;
  return CHECKLIST_DOCUMENTOS_DEFAULT;
}

export async function updateOrgChecklist(
  orgId: string,
  checklist: DocumentoChecklist[]
): Promise<void> {
  await pool.query(
    `INSERT INTO org_settings (organization_id, checklist_documentos)
     VALUES ($1, $2)
     ON CONFLICT (organization_id) DO UPDATE SET
       checklist_documentos = $2,
       updated_at = NOW()`,
    [orgId, JSON.stringify(checklist)]
  );
}

// ─── HELPERS ──────────────────────────────────

function parseChecklistJson(value: unknown): DocumentoChecklist[] {
  if (!value) return [];
  // pg returns JSONB as parsed JS, but defensive against double-encoded strings
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? parsed : [];
}

async function getEffectiveChecklist(
  orgId: string,
  vacanteChecklist?: DocumentoChecklist[] | string | null,
  client?: { query: typeof pool.query }
): Promise<DocumentoChecklist[]> {
  const vacanteParsed = parseChecklistJson(vacanteChecklist);
  if (vacanteParsed.length > 0) return vacanteParsed;
  return getOrgChecklist(orgId, client);
}
