/**
 * Selection & Documents service.
 * Handles candidate selection, rejection, document checklist, and verification.
 */

import { pool } from '@/lib/db';
import { getAppUrl } from '@/lib/utils/url';
import { sendEmail } from './email.service';
import { crearNotificacion } from '@/lib/services/notificaciones.service';
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
import { transicionarEstado } from './pipeline-transicion.service';
import { NotFoundError, ValidationError } from '@/lib/utils/errors';
import type {
  SeleccionPayload,
  RechazoPayload,
  DocumentoChecklist,
  DocumentoCandidatoRow,
  DocumentoConLabel,
  TipoContrato,
} from '@/lib/types/seleccion.types';
import { CHECKLIST_DOCUMENTOS_DEFAULT } from '@/lib/types/seleccion.types';

// ─── SELECCIÓN ────────────────────────────────

export async function seleccionarCandidato(
  payload: SeleccionPayload,
  orgId: string,
  userId: string
): Promise<{ portalUrl: string; portalToken: string }> {
  const client = await pool.connect();
  // Un fallo DESPUES del COMMIT (por ejemplo getAppUrl() sin APP_URL al armar el
  // email) ejecutaba ROLLBACK sobre una transaccion ya cerrada: los datos si
  // quedaban guardados, pero el llamador recibia un 500 y no seguia con el
  // auto-avance a 'documentos_pendientes'. Esta bandera evita ese rollback
  // fantasma para que el error se propague sin ensuciar el estado.
  let comprometido = false;
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

    // 2. Update estado to seleccionado + save selection data.
    //
    // Los COALESCE son imprescindibles: esta funcion tambien se invoca desde el
    // selector de estado del pipeline, que solo manda `aplicacion_id`. Sin ellos,
    // reseleccionar a alguien (algo que la maquina de estados permite) borraba su
    // salario ofrecido, su fecha de inicio y su tipo de contrato — datos que
    // despues alimentan la generacion del contrato — y ademas resucitaba
    // requisitos de documentos que su contrato no exigia.
    await client.query(
      `UPDATE aplicaciones SET
        seleccionado_at = COALESCE(seleccionado_at, NOW()),
        tipo_contrato = COALESCE($2, tipo_contrato),
        fecha_inicio_tentativa = COALESCE($3, fecha_inicio_tentativa),
        salario_ofrecido = COALESCE($4, salario_ofrecido),
        moneda = COALESCE($5, moneda, 'COP'),
        updated_at = NOW()
       WHERE id = $1`,
      [
        payload.aplicacion_id,
        payload.tipo_contrato || null,
        payload.fecha_inicio_tentativa || null,
        payload.salario_ofrecido || null,
        payload.moneda || null,
      ]
    );

    const transicion = await transicionarEstado(payload.aplicacion_id, 'seleccionado', {
      runner: client,
      orgId,
      // Reseleccionar a alguien que ya paso al portal de documentos no debe
      // devolverlo al inicio del tramo final.
      noRetroceder: true,
    });

    // 3. Reusar el token de portal vigente, o emitir uno nuevo
    //
    // Antes se emitia SIEMPRE un token nuevo sin invalidar los anteriores. Eso
    // dejaba varios links vivos a la vez: el candidato abria el del primer
    // email, veia un estado que no correspondia y volvia a subir documentos.
    // Ahora se reutiliza el token vigente (los emails ya enviados siguen
    // funcionando) y solo se emite uno nuevo si no hay ninguno usable.
    const tokenVigente = await client.query(
      `SELECT token FROM portal_tokens
       WHERE aplicacion_id = $1 AND revocado_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [payload.aplicacion_id]
    );

    let portalToken: string = tokenVigente.rows[0]?.token;

    if (!portalToken) {
      portalToken = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Revoca cualquier token anterior antes de emitir el nuevo: solo puede
      // haber un link de portal activo por aplicacion.
      await client.query(
        `UPDATE portal_tokens SET revocado_at = NOW()
         WHERE aplicacion_id = $1 AND revocado_at IS NULL`,
        [payload.aplicacion_id]
      );

      await client.query(
        `INSERT INTO portal_tokens (aplicacion_id, token, expires_at) VALUES ($1, $2, $3)`,
        [payload.aplicacion_id, portalToken, expiresAt]
      );
    }

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

    // Filter by tipo_contrato.
    //
    // Se filtra por el tipo EFECTIVO ya guardado, no por el del payload: con los
    // COALESCE de arriba, una reseleccion sin `tipo_contrato` conserva el que ya
    // tenia, y usar el del payload (vacio) recrearia requisitos que ese contrato
    // no exige. Es el mismo filtro que evalua la completitud — si los dos lados
    // no coinciden, el candidato queda trancado o se le salta un requisito.
    const tipoEfectivo = await client.query(
      `SELECT tipo_contrato FROM aplicaciones WHERE id = $1`,
      [payload.aplicacion_id]
    );
    checklist = filtrarPorTipoContrato(checklist, tipoEfectivo.rows[0]?.tipo_contrato ?? null);

    // 5. Sincronizar el checklist de documentos (idempotente)
    //
    // ON CONFLICT DO NOTHING es lo que impide la duplicacion: si el candidato ya
    // tiene la fila de "cedula", una segunda seleccion no crea otra. Depende del
    // UNIQUE (aplicacion_id, tipo) de la migracion 032. Los documentos ya
    // subidos se conservan intactos — nunca se pisa el trabajo del candidato.
    if (checklist.length > 0) {
      for (const doc of checklist) {
        await client.query(
          `INSERT INTO documentos_candidato (aplicacion_id, tipo, nombre_archivo, url, estado)
           VALUES ($1, $2, $3, '', 'pendiente')
           ON CONFLICT (aplicacion_id, tipo) DO NOTHING`,
          [payload.aplicacion_id, doc.tipo, doc.label]
        );
      }

      // Limpia requisitos que ya no aplican (p. ej. cambio el tipo de contrato o
      // la organizacion edito el checklist). Solo se borran los que siguen
      // pendientes y sin archivo: nada que el candidato haya subido se pierde.
      await client.query(
        `DELETE FROM documentos_candidato
         WHERE aplicacion_id = $1
           AND estado = 'pendiente'
           AND (url IS NULL OR url = '')
           AND tipo <> ALL($2::text[])`,
        [payload.aplicacion_id, checklist.map((d) => d.tipo)]
      );
    }

    // 5b. Si el checklist efectivo no exige NINGUN documento, el tramo de
    // documentos esta cumplido desde el principio. Sin esto la aplicacion se
    // quedaba en 'documentos_pendientes' para siempre: el unico disparador de
    // 'documentos_completos' es una subida del candidato, y no habia nada que
    // subir — el estado es automatico, asi que el reclutador tampoco podia
    // asignarlo, y 'contratado' lo exige como prerequisito.
    const sinObligatorios = !checklist.some((d) => d.requerido);
    if (sinObligatorios) {
      await client.query(
        `UPDATE aplicaciones SET documentos_completos = true, updated_at = NOW() WHERE id = $1`,
        [payload.aplicacion_id]
      );
    }

    // 6. Log activity — solo si de verdad hubo un cambio de estado.
    // Esta funcion es idempotente y se puede invocar varias veces sobre la misma
    // aplicacion; registrar cada llamada llenaba la auditoria de filas
    // 'seleccionado' identicas para un unico evento real.
    if (transicion.cambiado) {
      await client.query(
        `INSERT INTO activity_log (organization_id, user_id, entity_type, entity_id, action, details)
         VALUES ($1, $2, 'aplicacion', $3, 'seleccionado', $4)`,
        [orgId, userId, payload.aplicacion_id, JSON.stringify({
          candidato: `${app.candidato_nombre} ${app.candidato_apellido}`,
          vacante: app.vacante_titulo,
          tipo_contrato: payload.tipo_contrato,
        })]
      );
    }

    await client.query('COMMIT');
    comprometido = true;

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
    if (!comprometido) await client.query('ROLLBACK');
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

      // Descarte masivo por la misma via que el resto del pipeline: si se hace
      // con un UPDATE crudo, `estados_completados` no registra la etapa en la
      // que iba el candidato y al reactivarlo pierde todo el historial (tendria
      // que recorrer el proceso otra vez desde cero).
      await transicionarEstado(aplicacionId, 'descartado', { orgId });
      await pool.query(
        `UPDATE aplicaciones SET motivo_descarte = $2, updated_at = NOW() WHERE id = $1`,
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

/** Prioridad de estados al resolver un empate entre filas del mismo tipo. */
const PRIORIDAD_ESTADO: Record<string, number> = {
  verificado: 1,
  subido: 2,
  rechazado: 3,
  pendiente: 4,
};

/**
 * Convierte filas de documentos_candidato en documentos con label del checklist,
 * dejando UNA sola entrada por tipo.
 *
 * La migracion 032 ya impide crear duplicados, pero la deduplicacion se hace
 * igual aqui por dos razones: una base que todavia no corrio la migracion no
 * debe mostrarle al candidato "Cedula" dos veces, y el portal es publico —
 * conviene que sea defensivo. Ante varias filas del mismo tipo gana la de estado
 * mas avanzado, y entre iguales la que tenga archivo.
 */
function mapDocumentosConLabel(
  rows: DocumentoCandidatoRow[],
  checklist: DocumentoChecklist[],
  aplicacionId?: string
): DocumentoConLabel[] {
  const checklistMap = new Map(checklist.map(c => [c.tipo, c]));
  const porTipo = new Map<string, DocumentoConLabel>();

  for (const doc of rows) {
    const config = checklistMap.get(doc.tipo);
    const candidato: DocumentoConLabel = {
      ...doc,
      label: config?.label || doc.nombre_archivo || doc.tipo,
      descripcion: config?.descripcion,
      requerido: config?.requerido ?? false,
    };

    const existente = porTipo.get(doc.tipo);
    if (!existente) {
      porTipo.set(doc.tipo, candidato);
      continue;
    }

    const rank = (d: DocumentoConLabel) =>
      (PRIORIDAD_ESTADO[d.estado] ?? 5) * 10 + (d.url ? 0 : 1);
    if (rank(candidato) < rank(existente)) porTipo.set(doc.tipo, candidato);
  }

  // Requisitos del checklist que todavia no tienen fila.
  //
  // Pasa cuando la organizacion o la vacante editan el checklist DESPUES de
  // haber seleccionado al candidato. Sin esto, el portal se dibuja solo con las
  // filas existentes: el candidato veia una pantalla sin documentos (y la barra
  // al 100%) mientras el recordatorio automatico le nombraba un documento que
  // la pantalla no le ofrecia — proceso trancado y sin salida.
  //
  // El placeholder se ordena al final y no tiene id: la subida se identifica por
  // (aplicacion_id, tipo), asi que crea la fila cuando llegue el archivo.
  for (const config of checklist) {
    if (porTipo.has(config.tipo)) continue;
    porTipo.set(config.tipo, {
      id: '',
      aplicacion_id: aplicacionId ?? '',
      tipo: config.tipo,
      nombre_archivo: null,
      url: '',
      estado: 'pendiente',
      created_at: new Date().toISOString(),
      label: config.label,
      descripcion: config.descripcion,
      requerido: config.requerido ?? false,
    });
  }

  return Array.from(porTipo.values());
}

/**
 * Checklist que realmente aplica a UNA aplicacion concreta.
 *
 * `getEffectiveChecklist` resuelve la herencia vacante > organizacion > default,
 * pero devuelve el catalogo completo. Cada documento puede declarar
 * `aplica_para` (tipos de contrato a los que corresponde), y `seleccionarCandidato`
 * usa ese filtro al crear las filas. Si la completitud se evalua contra el
 * catalogo SIN filtrar, un documento obligatorio que no aplica a este contrato
 * (y que por eso nunca tuvo fila) se cuenta como faltante para siempre: el
 * candidato queda trancado en 'documentos_pendientes' y jamas puede contratarse.
 *
 * Todo calculo de "estan completos los documentos?" debe partir de aqui.
 */
export async function getChecklistAplicacion(
  aplicacionId: string,
  orgId: string,
  vacanteChecklist?: string | DocumentoChecklist[] | null,
  tipoContrato?: string | null
): Promise<DocumentoChecklist[]> {
  let checklistVacante = vacanteChecklist;
  let tipo = tipoContrato;

  // Si el llamador no traia los datos, se leen aqui.
  if (checklistVacante === undefined || tipo === undefined) {
    const info = await pool.query(
      `SELECT a.tipo_contrato, v.checklist_documentos AS vacante_checklist
       FROM aplicaciones a
       JOIN vacantes v ON v.id = a.vacante_id
       WHERE a.id = $1`,
      [aplicacionId]
    );
    checklistVacante = info.rows[0]?.vacante_checklist;
    tipo = info.rows[0]?.tipo_contrato ?? null;
  }

  const checklist = await getEffectiveChecklist(orgId, checklistVacante);
  return filtrarPorTipoContrato(checklist, tipo);
}

/**
 * Valida que `tipo` pertenezca al checklist efectivo de la aplicacion.
 *
 * CRITICO: se debe llamar ANTES de escribir el archivo a S3 (en /presign,
 * antes de emitir la URL firmada), no solo al confirmar la subida. Antes esta
 * comprobacion vivia unicamente dentro de `uploadDocumentoPortal`, que en el
 * flujo directo-a-S3 se ejecuta en el paso de /confirm — es decir, DESPUES de
 * que el navegador ya subio el archivo directo a S3 con la URL firmada. Si
 * esta validacion rechazaba el tipo en ese punto, el archivo quedaba huerfano
 * en S3 para siempre: la subida ya habia ocurrido y no habia como deshacerla,
 * y la base de datos nunca se enteraba. El candidato veia un error o (peor)
 * ninguno, y el reclutador veia el documento como "nunca subido" con el
 * archivo real sentado en el bucket sin ninguna fila que lo referenciara.
 */
export async function validarTipoDocumentoPermitido(
  aplicacionId: string,
  orgId: string,
  tipo: string,
  checklistVacante?: string | DocumentoChecklist[] | null,
  tipoContrato?: string | null
): Promise<void> {
  const checklistValido = await getChecklistAplicacion(aplicacionId, orgId, checklistVacante, tipoContrato);
  if (!checklistValido.some((c) => c.tipo === tipo)) {
    throw new ValidationError('Este documento no forma parte de tu lista de requisitos.');
  }
}

/**
 * Aplica el filtro `aplica_para` de forma conservadora.
 *
 * Si el tipo de contrato no pertenece al vocabulario de `aplica_para`, NO se
 * filtra nada. Filtrar con un valor que el campo no sabe interpretar descartaria
 * todos los documentos que lo declaran — incluidos los obligatorios — y el
 * sistema daria el proceso por completo sin haberlos pedido jamas. Ante la duda
 * se pide de mas, nunca de menos.
 */
/**
 * Traduce el slug de `tipos_contrato` a la categoria que entiende `aplica_para`.
 *
 * Los dos vocabularios nacieron separados y solo comparten
 * 'prestacion_servicios', asi que el filtro era decorativo: con un contrato
 * 'indefinido' (el caso mas comun) no descartaba nada y al candidato se le
 * pedian RUT y certificados que su contrato no exige. Todas las modalidades
 * laborales colombianas se agrupan bajo 'laboral'.
 */
const SLUG_A_CATEGORIA: Record<string, TipoContrato> = {
  indefinido: 'laboral',
  termino_fijo: 'laboral',
  obra_labor: 'laboral',
  aprendizaje: 'laboral',
  laboral: 'laboral',
  prestacion_servicios: 'prestacion_servicios',
  horas_demanda: 'horas_demanda',
};

export function filtrarPorTipoContrato(
  checklist: DocumentoChecklist[],
  tipo: string | null | undefined
): DocumentoChecklist[] {
  if (!tipo) return checklist;
  const categoria = SLUG_A_CATEGORIA[tipo];
  // Ante un tipo que no sabemos traducir se prefiere pedir de mas antes que
  // saltarse un obligatorio en silencio.
  if (!categoria) return checklist;
  const tipoAplicable = categoria;
  return checklist.filter(
    (d) => !d.aplica_para || d.aplica_para.length === 0 || d.aplica_para.includes(tipoAplicable)
  );
}

/**
 * Evalua si los documentos obligatorios de una aplicacion estan cubiertos.
 *
 * Se mide contra el checklist EFECTIVO, no contra las filas existentes: un
 * obligatorio al que le falta la fila debe contar como faltante (antes era
 * invisible y el sistema daba el proceso por completo).
 *
 * Con cero obligatorios devuelve false a proposito: no hay nada que el candidato
 * deba demostrar, asi que el avance lo decide una persona (boton "Forzar" del
 * selector) en vez de dispararse solo apenas se selecciona al candidato.
 */
export function evaluarCompletitud(
  checklistEfectivo: DocumentoChecklist[],
  documentos: { tipo: string; estado: string }[]
): { completo: boolean; faltantes: DocumentoChecklist[] } {
  const estadoPorTipo = new Map(documentos.map((d) => [d.tipo, d.estado]));
  const requeridos = checklistEfectivo.filter((c) => c.requerido);

  const faltantes = requeridos.filter((req) => {
    const estado = estadoPorTipo.get(req.tipo);
    return estado !== 'subido' && estado !== 'verificado';
  });

  // Sin documentos obligatorios no hay nada que el candidato deba demostrar: el
  // proceso esta completo. Devolver siempre false dejaba al candidato ante un
  // portal en blanco que pedia documentos inexistentes, y al reclutador sin
  // avance automatico hacia 'contratado'.
  return { completo: faltantes.length === 0, faltantes };
}

export async function getChecklistDocumentos(
  aplicacionId: string,
  orgId: string
): Promise<{ documentos: DocumentoConLabel[]; completo: boolean; portalUrl: string | null }> {
  // Verify ownership
  const appResult = await pool.query(
    `SELECT a.portal_token, a.tipo_contrato, v.checklist_documentos as vacante_checklist
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

  const checklist = await getChecklistAplicacion(
    aplicacionId,
    orgId,
    appResult.rows[0].vacante_checklist,
    appResult.rows[0].tipo_contrato
  );
  const documentos = mapDocumentosConLabel(docs.rows, checklist, aplicacionId);
  const { completo } = evaluarCompletitud(checklist, documentos);

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
  // documentos_completos = true cuando todos los obligatorios estan al menos
  // subidos. Verificar es un paso aparte: que el reclutador apruebe uno no debe
  // bajar la bandera porque los otros aun no esten aprobados.
  const { completo } = await getChecklistDocumentos(aplicacionId, orgId);

  await pool.query(
    `UPDATE aplicaciones SET documentos_completos = $2, updated_at = NOW() WHERE id = $1`,
    [aplicacionId, completo]
  );

  if (completo) {
    // Mismo auto-avance que en la subida desde el portal: si el reclutador
    // completa el checklist por su cuenta, el pipeline tiene que avanzar igual.
    await transicionarEstado(aplicacionId, 'documentos_completos', {
      soloDesde: ['seleccionado', 'documentos_pendientes'],
      orgId,
    });
  } else {
    // Rechazar un documento obligatorio vuelve a abrir la etapa. Sin esto la
    // aplicacion se quedaba en 'documentos_completos' con la bandera en false y
    // el reclutador podia contratar a alguien con documentos rechazados.
    await transicionarEstado(aplicacionId, 'documentos_pendientes', {
      soloDesde: ['documentos_completos'],
      noRetroceder: false,
      orgId,
    });
  }
}

// ─── PORTAL (PUBLIC) ──────────────────────────

/**
 * Datos del portal publico de documentos.
 *
 * @param registrarAcceso incrementa `used_count`. Solo debe ir en true cuando el
 *   candidato realmente abre el portal. Las rutas de presign/upload/confirm
 *   tambien llaman a esta funcion para validar el token, y contarlas inflaba el
 *   contador ~4 veces por cada archivo subido, dejandolo inservible.
 */
export async function getPortalData(token: string, registrarAcceso = false) {
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

  // Un token revocado se trata como expirado: se emitio uno nuevo para esta
  // aplicacion y el candidato debe usar el link mas reciente.
  if (isExpired || tokenRow.revocado_at) {
    return { token_valid: false, expired: true };
  }

  if (registrarAcceso) {
    await pool.query(
      `UPDATE portal_tokens SET used_count = used_count + 1 WHERE id = $1`,
      [tokenRow.id]
    );
  }

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

  // Checklist EFECTIVO (filtrado por el tipo de contrato de esta aplicacion) y
  // la MISMA definicion de completitud que usa el resto del sistema. Antes esta
  // era una tercera formula distinta: el portal podia decirle "completo" al
  // candidato mientras el backend seguia considerando el proceso incompleto.
  const checklist = await getChecklistAplicacion(
    tokenRow.aplicacion_id,
    data.org_id,
    data.vacante_checklist,
    tokenRow.tipo_contrato
  );
  const documentosCompletos = mapDocumentosConLabel(docs.rows, checklist, tokenRow.aplicacion_id);
  const { completo, faltantes } = evaluarCompletitud(checklist, documentosCompletos);

  const subidos = documentosCompletos.filter(d => d.estado === 'subido' || d.estado === 'verificado').length;
  const verificados = documentosCompletos.filter(d => d.estado === 'verificado').length;

  // Este endpoint es publico (solo hace falta el token). Se devuelve unicamente
  // lo que el portal necesita pintar: el spread de la fila completa exponia el
  // `aplicacion_id`, los ids de documento y sobre todo `verificado_por`, que es
  // el UUID de un usuario interno de la empresa.
  const documentos = documentosCompletos.map(d => ({
    id: d.id,
    tipo: d.tipo,
    nombre_archivo: d.nombre_archivo,
    url: d.url,
    estado: d.estado,
    nota_rechazo: d.nota_rechazo ?? null,
    label: d.label,
    descripcion: d.descripcion,
    requerido: d.requerido,
  })) as DocumentoConLabel[];

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
      requeridos_faltantes: faltantes.length,
    },
    completo,
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
    `SELECT pt.aplicacion_id, a.estado AS estado_aplicacion,
            a.tipo_contrato, v.organization_id, v.checklist_documentos
     FROM portal_tokens pt
     JOIN aplicaciones a ON a.id = pt.aplicacion_id
     JOIN vacantes v ON v.id = a.vacante_id
     WHERE pt.token = $1 AND pt.expires_at > NOW() AND pt.revocado_at IS NULL`,
    [token]
  );
  if (tokenResult.rows.length === 0) {
    throw new ValidationError('Token invalido o expirado');
  }
  const aplicacionId = tokenResult.rows[0].aplicacion_id;

  // El portal solo acepta subidas mientras el proceso esta en la etapa de
  // documentos. El token dura 30 dias, asi que sin esta comprobacion un
  // candidato YA CONTRATADO podia seguir cambiando sus archivos despues de la
  // revision.
  const ESTADOS_ADMITEN_SUBIDA = ['seleccionado', 'documentos_pendientes', 'documentos_completos'];
  if (!ESTADOS_ADMITEN_SUBIDA.includes(tokenResult.rows[0].estado_aplicacion)) {
    throw new ValidationError('Este proceso ya avanzo y no admite mas documentos.');
  }

  // El `tipo` llega del cliente. Sin acotarlo al checklist efectivo, cada valor
  // inventado creaba una fila nueva (y una notificacion) desde un endpoint sin
  // sesion: 40 peticiones bastaban para sepultar el checklist real del
  // reclutador bajo decenas de documentos basura.
  //
  // Esta misma validacion TAMBIEN se llama desde /presign, antes de emitir la
  // URL firmada de S3 — ver `validarTipoDocumentoPermitido`. Aqui se repite a
  // proposito como defensa en profundidad para el flujo tradicional (/upload,
  // que sube primero a storage y llama a esta funcion despues): si algun dia
  // /presign deja de llamarla, esta funcion sigue protegida por su cuenta.
  await validarTipoDocumentoPermitido(
    aplicacionId,
    tokenResult.rows[0].organization_id,
    tipo,
    tokenResult.rows[0].checklist_documentos,
    tokenResult.rows[0].tipo_contrato
  );

  // Update document. Se identifica por (aplicacion_id, tipo) — que ahora es
  // unico — usando el id solo como pista. Asi una subida repetida del mismo
  // documento SIEMPRE reemplaza la fila existente en vez de crear otra, aunque
  // el candidato tenga abierta una pestaña vieja con ids de una version previa
  // del checklist.
  const result = await pool.query(
    `UPDATE documentos_candidato d SET
      nombre_archivo = $3,
      url = $4,
      estado = 'subido',
      nota_rechazo = NULL,
      -- Reemplazar el archivo INVALIDA la verificacion previa. Sin esto, el
      -- candidato cambiaba el documento y la fila seguia mostrando "verificado
      -- el <fecha>" sobre un archivo que nadie habia revisado.
      verificado_por = NULL,
      verificado_at = NULL,
      subido_at = NOW(),
      updated_at = NOW()
     FROM (
       SELECT id, url AS url_anterior FROM documentos_candidato
       WHERE aplicacion_id = $1 AND tipo = $2
     ) prev
     WHERE d.id = prev.id
     RETURNING d.*, prev.url_anterior`,
    [aplicacionId, tipo, nombreArchivo, url]
  );

  // Borra el archivo que acaba de ser reemplazado. Sin esto, resubir el mismo
  // documento con otra extension (cedula.pdf -> cedula.jpg) dejaba el primero
  // huerfano en almacenamiento: la BD apuntaba solo al ultimo pero el anterior
  // seguia ocupando espacio para siempre. No es bloqueante.
  const urlAnterior: string | null = result.rows[0]?.url_anterior || null;
  if (urlAnterior && urlAnterior !== url) {
    try {
      const { deleteFile } = await import('@/lib/utils/file-storage');
      await deleteFile(urlAnterior);
    } catch (err) {
      console.error('[Seleccion] No se pudo borrar el archivo reemplazado:', err);
    }
  }

  if (result.rows.length === 0) {
    // El tipo no estaba en el checklist de esta aplicacion (checklist editado
    // despues de enviar el link). Se crea la fila para no perder el archivo.
    const insertado = await pool.query(
      `INSERT INTO documentos_candidato
         (aplicacion_id, tipo, nombre_archivo, url, estado, subido_at, updated_at)
       VALUES ($1, $2, $3, $4, 'subido', NOW(), NOW())
       ON CONFLICT (aplicacion_id, tipo) DO UPDATE SET
         nombre_archivo = EXCLUDED.nombre_archivo,
         url = EXCLUDED.url,
         estado = 'subido',
         nota_rechazo = NULL,
         subido_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [aplicacionId, tipo, nombreArchivo, url]
    );
    if (insertado.rows.length === 0) {
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
      await crearNotificacion({
        organizacionId: orgIdNotif,
        tipo: 'documento_subido',
        titulo: 'Documento subido',
        mensaje: `${tipo} subido por candidato`,
        meta: { aplicacion_id: aplicacionId },
      });
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
    `SELECT a.tipo_contrato, v.organization_id, v.checklist_documentos
     FROM aplicaciones a JOIN vacantes v ON v.id = a.vacante_id
     WHERE a.id = $1`,
    [aplicacionId]
  );
  const orgId = appData.rows[0]?.organization_id;

  // Checklist EFECTIVO de esta aplicacion (filtrado por su tipo de contrato).
  // Usar el catalogo completo dejaba como "faltante" perpetuo cualquier
  // obligatorio que no aplica a este contrato y que por eso nunca tuvo fila.
  const checklist = await getChecklistAplicacion(
    aplicacionId,
    orgId,
    appData.rows[0]?.checklist_documentos,
    appData.rows[0]?.tipo_contrato
  );

  const { completo: allRequiredUploaded } = evaluarCompletitud(
    checklist,
    docs.rows as DocumentoCandidatoRow[]
  );

  if (allRequiredUploaded) {
    await pool.query(
      `UPDATE aplicaciones SET documentos_completos = true, updated_at = NOW() WHERE id = $1`,
      [aplicacionId]
    );

    // Avanzar el pipeline automaticamente.
    //
    // Antes solo se marcaba la bandera `documentos_completos` y el estado se
    // quedaba en 'documentos_pendientes' para siempre. Como el estado
    // 'documentos_completos' esta marcado como automatico, el selector se lo
    // bloqueaba al reclutador ("este estado se asigna automaticamente") y
    // 'contratado' lo exige como prerequisito: el candidato terminaba con todos
    // los papeles al dia e imposible de contratar. Aqui es donde ese estado
    // debia asignarse.
    await transicionarEstado(aplicacionId, 'documentos_completos', {
      soloDesde: ['seleccionado', 'documentos_pendientes'],
      orgId,
    });

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
        await crearNotificacion({
          organizacionId: orgId,
          tipo: 'documentos_completos',
          titulo: 'Documentos completos',
          mensaje: `${candNombre} completo todos los documentos`,
          meta: { aplicacion_id: aplicacionId, url: `/vacantes/${vacanteIdNotif}` },
        });
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
       JOIN users u ON u.organization_id = v.organization_id AND u.role IN ('admin', 'recruiter')
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
  // pg devuelve JSONB ya parseado, pero un JSONB que contiene un string llega
  // como string de JS cuyo contenido NO es JSON. Sin el try/catch, un dato mal
  // sembrado tumbaba con un 500 el portal publico del candidato y todas las
  // lecturas de checklist del reclutador. Ante datos corruptos se prefiere un
  // checklist vacio (visible y corregible) a una pagina caida.
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error('[Checklist] JSON invalido en la configuracion, se ignora:', value);
    return [];
  }
}

export async function getEffectiveChecklist(
  orgId: string,
  vacanteChecklist?: DocumentoChecklist[] | string | null,
  client?: { query: typeof pool.query }
): Promise<DocumentoChecklist[]> {
  const vacanteParsed = parseChecklistJson(vacanteChecklist);
  if (vacanteParsed.length > 0) return vacanteParsed;
  return getOrgChecklist(orgId, client);
}
