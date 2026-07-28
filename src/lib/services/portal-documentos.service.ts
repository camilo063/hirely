/**
 * Ciclo de vida del portal publico de documentos: renovacion de links vencidos
 * y recordatorios automaticos.
 *
 * Vive aparte de seleccion.service.ts a proposito: aquel resuelve "que pasa
 * cuando selecciono a alguien", este resuelve "que pasa despues, mientras el
 * candidato tiene la pelota".
 */

import { pool } from '@/lib/db';
import { randomBytes } from 'crypto';
import { getAppUrl } from '@/lib/utils/url';
import { sendEmail } from './email.service';
import { getChecklistAplicacion, evaluarCompletitud } from './seleccion.service';
import {
  emailRecordatorioDocumentosTemplate,
  emailLinkRenovadoTemplate,
} from '@/lib/utils/email-templates';
import type { DocumentoCandidatoRow } from '@/lib/types/seleccion.types';

/** Vigencia de un token de portal, en dias. */
const DIAS_VIGENCIA_TOKEN = 30;

/**
 * Dias desde la seleccion en los que se manda cada recordatorio.
 * El cron corre a diario y usa el ultimo envio para no repetirse.
 */
const DIAS_RECORDATORIO = [2, 5, 10];

export interface ResultadoRenovacion {
  ok: boolean;
  /** Motivo para el usuario cuando ok = false. */
  mensaje: string;
  /** Email ofuscado al que se mando el link (para confirmar sin exponerlo). */
  emailDestino?: string;
}

/**
 * Emite un token nuevo a partir de uno vencido y lo envia por correo.
 *
 * El link nuevo NO se devuelve al cliente: se manda al email registrado del
 * candidato. Asi, tener un link viejo no basta para recuperar el acceso si
 * quien lo tiene no controla ese buzon.
 */
/**
 * Espera minima entre dos renovaciones de la misma aplicacion.
 * Sin este freno, el endpoint (publico) permitia disparar un correo por
 * peticion: con un link filtrado se podia bombardear el buzon del candidato y
 * quemar la reputacion del dominio de envio.
 */
const MINUTOS_ENTRE_RENOVACIONES = 10;

export async function renovarTokenPortal(tokenAntiguo: string): Promise<ResultadoRenovacion> {
  const info = await pool.query(
    `SELECT pt.aplicacion_id,
            pt.expires_at,
            pt.revocado_at,
            a.estado,
            c.email  AS candidato_email,
            c.nombre AS candidato_nombre,
            c.apellido AS candidato_apellido,
            v.titulo AS vacante_titulo,
            o.name   AS org_nombre,
            (SELECT MAX(created_at) FROM portal_tokens WHERE aplicacion_id = pt.aplicacion_id)
              AS ultima_emision
     FROM portal_tokens pt
     JOIN aplicaciones a  ON a.id = pt.aplicacion_id
     JOIN candidatos c    ON c.id = a.candidato_id
     JOIN vacantes v      ON v.id = a.vacante_id
     JOIN organizations o ON o.id = v.organization_id
     WHERE pt.token = $1
     LIMIT 1`,
    [tokenAntiguo]
  );

  if (info.rows.length === 0) {
    return { ok: false, mensaje: 'Este link no corresponde a ningun proceso activo.' };
  }

  const row = info.rows[0];

  // Solo se renuevan links que ya no sirven. Antes se aceptaba cualquier token,
  // incluido el VIGENTE — y como la renovacion revoca los anteriores, bastaba un
  // link viejo para dejar sin acceso al candidato que estaba usando el bueno.
  const vencido = new Date(row.expires_at) < new Date();
  const revocado = !!row.revocado_at;
  if (!vencido && !revocado) {
    return {
      ok: false,
      mensaje: 'Este link sigue vigente. Puedes usarlo para subir tus documentos.',
    };
  }

  // Si el proceso ya avanzo mas alla de los documentos, renovar no tiene sentido.
  const ESTADOS_CON_PORTAL = ['seleccionado', 'documentos_pendientes', 'documentos_completos'];
  if (!ESTADOS_CON_PORTAL.includes(row.estado)) {
    return {
      ok: false,
      mensaje: 'Tu proceso ya avanzo y no necesitas subir mas documentos. Contacta al equipo si tienes dudas.',
    };
  }

  if (!row.candidato_email) {
    return {
      ok: false,
      mensaje: 'No tenemos un correo registrado para enviarte el link. Contacta al equipo de recursos humanos.',
    };
  }

  const nuevoToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + DIAS_VIGENCIA_TOKEN * 24 * 60 * 60 * 1000);
  const candidatoNombre = `${row.candidato_nombre} ${row.candidato_apellido || ''}`.trim();

  // El correo se arma ANTES de tocar la base: si `getAppUrl()` falla por falta
  // de configuracion, se aborta sin haber invalidado nada.
  const portalUrl = `${getAppUrl()}/portal/documentos/${nuevoToken}`;
  const email = emailLinkRenovadoTemplate({
    candidatoNombre,
    empresaNombre: row.org_nombre,
    vacanteTitulo: row.vacante_titulo,
    portalUrl,
    diasVigencia: DIAS_VIGENCIA_TOKEN,
  });

  // Freno de repeticion + emision del token, SERIALIZADOS.
  //
  // Este endpoint es publico y sin sesion, asi que dos peticiones a la vez (un
  // doble clic basta) llegaban juntas: ambas leian el mismo `ultima_emision`,
  // ambas pasaban el freno, ambas insertaban su token y despues cada una
  // revocaba "todos menos el mio" — dejando al candidato con VARIOS correos y
  // CERO links usables, bloqueado 10 minutos por su propio rate limit y fuera
  // del cron de recordatorios (que exige un token vivo).
  //
  // El lock sobre la fila de la aplicacion serializa el tramo critico: la
  // segunda peticion espera, vuelve a leer y se topa con el freno.
  const lockClient = await pool.connect();
  try {
    await lockClient.query('BEGIN');
    await lockClient.query(`SELECT id FROM aplicaciones WHERE id = $1 FOR UPDATE`, [
      row.aplicacion_id,
    ]);

    // El freno se mide sobre el ultimo ENVIO CONFIRMADO, no sobre la emision del
    // token. Medirlo sobre la emision hacia que, tras un fallo de correo, el
    // candidato recibiera durante 10 minutos un "revisa tu correo" sobre un
    // mensaje que nunca salio.
    const ultima = await lockClient.query(
      `SELECT MAX(created_at) AS ultima_emision
       FROM portal_tokens
       WHERE aplicacion_id = $1 AND enviado_at IS NOT NULL`,
      [row.aplicacion_id]
    );
    const ultimaEmision = ultima.rows[0]?.ultima_emision;
    if (ultimaEmision) {
      const minutos = (Date.now() - new Date(ultimaEmision).getTime()) / 60000;
      if (minutos < MINUTOS_ENTRE_RENOVACIONES) {
        await lockClient.query('ROLLBACK');
        return {
          ok: false,
          mensaje: `Ya enviamos un link hace poco. Revisa tu correo (incluida la carpeta de spam) o intenta de nuevo en ${Math.ceil(
            MINUTOS_ENTRE_RENOVACIONES - minutos
          )} minutos.`,
        };
      }
    }

    // Se inserta el token nuevo pero NO se revoca nada todavia: si el correo no
    // sale, el candidato debe conservar el acceso que tenia. Revocar primero lo
    // dejaba encerrado con un link nuevo que solo existia en un email fantasma.
    await lockClient.query(
      `INSERT INTO portal_tokens (aplicacion_id, token, expires_at) VALUES ($1, $2, $3)`,
      [row.aplicacion_id, nuevoToken, expiresAt]
    );
    await lockClient.query('COMMIT');
  } catch (error) {
    await lockClient.query('ROLLBACK');
    throw error;
  } finally {
    lockClient.release();
  }

  const enviado = await sendEmail({
    to: row.candidato_email,
    subject: email.subject,
    htmlBody: email.htmlBody,
    textBody: email.textBody,
  });

  if (!enviado) {
    // Se descarta el token que nadie llego a conocer. El freno de repeticion ya
    // no depende de que esta fila exista: se mide sobre `enviado_at`, asi que
    // borrarla no reabre la puerta a reintentos sin tope.
    await pool.query(`DELETE FROM portal_tokens WHERE token = $1 AND enviado_at IS NULL`, [nuevoToken]);
    console.error(`[Portal] No se pudo enviar el link renovado a la aplicacion ${row.aplicacion_id}`);
    return {
      ok: false,
      mensaje:
        'No pudimos enviarte el correo en este momento. Intenta de nuevo en unos minutos o contacta al equipo de recursos humanos.',
    };
  }

  // El correo salio: recien ahora se invalidan los links anteriores.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE portal_tokens SET enviado_at = NOW() WHERE token = $1`,
      [nuevoToken]
    );
    // Solo se revocan los ANTERIORES al recien emitido. Un "todos menos el mio"
    // podria matar un token mas nuevo si alguna vez se emitieran dos en paralelo.
    await client.query(
      `UPDATE portal_tokens SET revocado_at = NOW()
       WHERE aplicacion_id = $1
         AND revocado_at IS NULL
         AND created_at < (SELECT created_at FROM portal_tokens WHERE token = $2)`,
      [row.aplicacion_id, nuevoToken]
    );
    await client.query(
      `UPDATE aplicaciones SET portal_token = $2, updated_at = NOW() WHERE id = $1`,
      [row.aplicacion_id, nuevoToken]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    ok: true,
    mensaje: 'Te enviamos un link nuevo a tu correo.',
    emailDestino: ofuscarEmail(row.candidato_email),
  };
}

/** a****z@dominio.com — confirma el destino sin exponer la direccion completa. */
function ofuscarEmail(email: string): string {
  const [usuario, dominio] = email.split('@');
  if (!dominio) return '***';
  if (usuario.length <= 2) return `${usuario[0]}***@${dominio}`;
  return `${usuario[0]}${'*'.repeat(Math.min(usuario.length - 2, 5))}${usuario[usuario.length - 1]}@${dominio}`;
}

export interface ResumenRecordatorios {
  revisados: number;
  enviados: number;
  errores: number;
  detalle: { aplicacionId: string; candidato: string; recordatorio: number }[];
}

/**
 * Envia recordatorios a los candidatos que dejaron documentos a medias.
 *
 * Se ejecuta desde el cron diario. Un candidato recibe como maximo
 * DIAS_RECORDATORIO.length recordatorios, espaciados segun ese arreglo y
 * contados desde su seleccion. Nunca manda dos el mismo dia.
 */
export async function enviarRecordatoriosDocumentos(
  orgId?: string
): Promise<ResumenRecordatorios> {
  const resumen: ResumenRecordatorios = { revisados: 0, enviados: 0, errores: 0, detalle: [] };

  const candidatos = await pool.query(
    `SELECT a.id AS aplicacion_id,
            a.documentos_recordatorios_enviados AS enviados,
            a.documentos_ultimo_recordatorio_at AS ultimo,
            a.portal_token,
            a.tipo_contrato,
            -- Ancla estable: la fecha de seleccion o, si falta, la de emision del
            -- token. NO se usa updated_at: cualquier escritura sobre la
            -- aplicacion (incluida la del propio checklist) lo movia y el
            -- contador de dias se reiniciaba solo, de modo que el recordatorio
            -- no llegaba nunca.
            EXTRACT(EPOCH FROM (NOW() - COALESCE(a.seleccionado_at, pt.created_at))) / 86400
              AS dias_desde_seleccion,
            pt.expires_at,
            c.email AS candidato_email, c.nombre AS candidato_nombre, c.apellido AS candidato_apellido,
            v.titulo AS vacante_titulo, v.organization_id, v.checklist_documentos AS vacante_checklist,
            o.name AS org_nombre
     FROM aplicaciones a
     JOIN candidatos c    ON c.id = a.candidato_id
     JOIN vacantes v      ON v.id = a.vacante_id
     JOIN organizations o ON o.id = v.organization_id
     -- La vigencia es imprescindible: sin ella, el cron recogia tokens YA
     -- VENCIDOS y (mas abajo) les extendia la vigencia, resucitando links
     -- caducados sin que nadie enviara nada. La caducidad de 30 dias dejaba de
     -- ser un control.
     JOIN portal_tokens pt ON pt.token = a.portal_token
       AND pt.revocado_at IS NULL
       AND pt.expires_at > NOW()
     -- Tambien 'seleccionado': si el auto-avance a 'documentos_pendientes' no
     -- llego a ejecutarse, el candidato igual tiene documentos que subir y no
     -- debe quedarse sin recordatorios.
     WHERE a.estado IN ('seleccionado', 'documentos_pendientes')
       AND a.documentos_completos = false
       AND c.email IS NOT NULL
       AND a.documentos_recordatorios_enviados < $1
       -- Nunca dos recordatorios el mismo dia.
       AND (a.documentos_ultimo_recordatorio_at IS NULL
            OR a.documentos_ultimo_recordatorio_at < NOW() - interval '20 hours')
       -- Acotado por organizacion cuando lo dispara una persona. Sin esto, una
       -- sesion cualquiera barria TODAS las empresas: enviaba correos a sus
       -- candidatos, consumia su presupuesto de recordatorios y escribia sobre
       -- sus tokens.
       AND ($2::uuid IS NULL OR v.organization_id = $2)`,
    [DIAS_RECORDATORIO.length, orgId ?? null]
  );

  for (const row of candidatos.rows) {
    resumen.revisados++;

    // Que recordatorio toca segun los dias transcurridos.
    //
    // Se cuenta cuantos hitos ya pasaron en vez de avanzar el contador de uno en
    // uno: si el cron estuvo caido, retomar en el dia 15 debe mandar el ULTIMO
    // aviso, no empezar por el primero y estirar la cadencia tres dias mas.
    const enviados = Number(row.enviados);
    const dias = Number(row.dias_desde_seleccion);
    const hitosCumplidos = DIAS_RECORDATORIO.filter((d) => dias >= d).length;
    if (hitosCumplidos <= enviados) continue;
    const siguiente = hitosCumplidos - 1; // indice del recordatorio a enviar

    try {
      // Solo se recuerda lo que realmente falta.
      const docs = await pool.query<DocumentoCandidatoRow>(
        `SELECT * FROM documentos_candidato WHERE aplicacion_id = $1`,
        [row.aplicacion_id]
      );
      // Checklist EFECTIVO: filtrado por el tipo de contrato de esta aplicacion.
      // Con el catalogo completo se le recordarian al candidato documentos que
      // su contrato ni siquiera exige y que nunca podria completar.
      const checklist = await getChecklistAplicacion(
        row.aplicacion_id,
        row.organization_id,
        row.vacante_checklist,
        row.tipo_contrato
      );
      const faltantes = evaluarCompletitud(checklist, docs.rows).faltantes.map((c) => c.label);

      // Si no falta nada, el flag quedo desincronizado: no molestamos al candidato.
      if (faltantes.length === 0) continue;

      const candidatoNombre = `${row.candidato_nombre} ${row.candidato_apellido || ''}`.trim();

      // Un recordatorio con un link a punto de morir no sirve de nada, asi que se
      // extiende la vigencia — pero SOLO despues de confirmar el envio (mas
      // abajo). Extenderla antes hacia que un envio fallido igualmente
      // prolongara el acceso, y con la consulta recogiendo tokens ya vencidos,
      // que un link caducado volviera a la vida sin avisar a nadie.
      const MS_DIA = 24 * 60 * 60 * 1000;
      const expiraEn = new Date(row.expires_at).getTime();
      const debeExtenderse = expiraEn < Date.now() + 7 * MS_DIA;
      const diasRestantes = debeExtenderse
        ? DIAS_VIGENCIA_TOKEN
        : Math.max(1, Math.ceil((expiraEn - Date.now()) / MS_DIA));

      const email = emailRecordatorioDocumentosTemplate({
        candidatoNombre,
        empresaNombre: row.org_nombre,
        vacanteTitulo: row.vacante_titulo,
        documentosFaltantes: faltantes,
        portalUrl: `${getAppUrl()}/portal/documentos/${row.portal_token}`,
        numeroRecordatorio: siguiente + 1,
        diasRestantes,
      });

      // sendEmail devuelve false (no lanza) cuando Resend no esta configurado o
      // rechaza el envio. Solo se consume el recordatorio si de verdad salio:
      // de lo contrario un problema de configuracion agotaria los 3 intentos en
      // silencio y el candidato no recibiria ninguno.
      const enviado = await sendEmail({
        to: row.candidato_email,
        subject: email.subject,
        htmlBody: email.htmlBody,
        textBody: email.textBody,
      });

      if (!enviado) {
        console.error(`[Recordatorios] Email no enviado para aplicacion ${row.aplicacion_id}`);
        resumen.errores++;
        continue;
      }

      // Envio confirmado: recien ahora se prolonga la vigencia del link.
      if (debeExtenderse) {
        await pool.query(
          `UPDATE portal_tokens SET expires_at = $2
           WHERE token = $1 AND revocado_at IS NULL AND expires_at > NOW()`,
          [row.portal_token, new Date(Date.now() + DIAS_VIGENCIA_TOKEN * MS_DIA)]
        );
      }

      // Se fija al hito alcanzado, no se incrementa: tras una caida del cron el
      // contador debe quedar alineado con los dias transcurridos.
      await pool.query(
        `UPDATE aplicaciones
         SET documentos_recordatorios_enviados = $2,
             documentos_ultimo_recordatorio_at = NOW()
         WHERE id = $1`,
        [row.aplicacion_id, hitosCumplidos]
      );

      resumen.enviados++;
      resumen.detalle.push({
        aplicacionId: row.aplicacion_id,
        candidato: candidatoNombre,
        recordatorio: siguiente + 1,
      });
    } catch (error) {
      console.error(`[Recordatorios] Error con aplicacion ${row.aplicacion_id}:`, error);
      resumen.errores++;
    }
  }

  return resumen;
}
