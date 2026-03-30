import { NextRequest } from 'next/server';
import { getOrgId, getUserId } from '@/lib/auth/middleware';
import { pool } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { aplicacionUpdateEstadoSchema } from '@/lib/validations/candidato.schema';
import { getTransicionesPermitidas } from '@/lib/constants/pipeline-states';
import { seleccionarCandidato } from '@/lib/services/seleccion.service';
import { sendEmail } from '@/lib/services/email.service';
import { emailRechazoTemplate, sustituirVariables } from '@/lib/utils/email-templates';
import { enviarParaFirma } from '@/lib/services/firma-electronica.service';
import { createContrato, autoPoblarDatos } from '@/lib/services/contratos.service';
import { enviarEmail } from '@/lib/services/email.service';
import { emailContratadoTemplate } from '@/lib/utils/email-templates';
import { crearNotificacion } from '@/lib/services/notificaciones.service';
import { emitirNotificacion } from '@/lib/services/sse-clients';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    const userId = await getUserId();
    const { id } = await params;
    const body = await request.json();
    const validated = aplicacionUpdateEstadoSchema.parse(body);
    const nuevoEstado = validated.estado;

    // 1. Get current estado and estados_completados
    const current = await pool.query(
      `SELECT a.estado, a.estados_completados,
              c.nombre as candidato_nombre, c.apellido as candidato_apellido,
              c.email as candidato_email,
              v.titulo as vacante_titulo, v.organization_id,
              o.name as org_nombre
       FROM aplicaciones a
       JOIN candidatos c ON c.id = a.candidato_id
       JOIN vacantes v ON v.id = a.vacante_id
       JOIN organizations o ON o.id = v.organization_id
       WHERE a.id = $1 AND v.organization_id = $2`,
      [id, orgId]
    );

    if (current.rowCount === 0) {
      return apiResponse({ error: 'Aplicacion no encontrada' }, 404);
    }

    const app = current.rows[0];
    const estadoActual = app.estado;
    const estadosCompletados: string[] = app.estados_completados || [];

    // 2. Validate transition using state machine
    const allowAuto = body.forzar_auto === true;
    const transiciones = getTransicionesPermitidas(estadoActual, estadosCompletados, { allowAuto });
    const transicion = transiciones.find((t) => t.state.key === nuevoEstado);

    if (!transicion || !transicion.permitida) {
      const razon = transicion?.razon || 'Transicion no permitida';
      return apiResponse(
        { error: razon, estado_actual: estadoActual, estado_solicitado: nuevoEstado },
        422
      );
    }

    // 3. Build updated estados_completados (append old estado if not already there)
    const nuevosEstadosCompletados = [...estadosCompletados];
    if (!nuevosEstadosCompletados.includes(estadoActual)) {
      nuevosEstadosCompletados.push(estadoActual);
    }

    // 4. Handle side effects for 'seleccionado'
    if (nuevoEstado === 'seleccionado') {
      try {
        await seleccionarCandidato(
          {
            aplicacion_id: id,
            enviar_email_seleccion: true,
          },
          orgId,
          userId
        );
      } catch (selError) {
        console.error('[Estado] Error en seleccionarCandidato:', selError);
        // seleccionarCandidato already sets estado to 'seleccionado',
        // so if it fails we should not proceed
        return apiResponse(
          { error: 'Error al procesar la seleccion del candidato' },
          500
        );
      }

      // Auto-advance to documentos_pendientes
      const completadosConSeleccionado = [...nuevosEstadosCompletados];
      if (!completadosConSeleccionado.includes('seleccionado')) {
        completadosConSeleccionado.push('seleccionado');
      }

      await pool.query(
        `UPDATE aplicaciones
         SET estado = 'documentos_pendientes',
             estados_completados = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [id, completadosConSeleccionado]
      );

      // Log activity
      try {
        await pool.query(
          `INSERT INTO activity_log (organization_id, user_id, entidad, entidad_id, accion, detalles)
           VALUES ($1, $2, 'aplicacion', $3, 'cambio_estado', $4)`,
          [
            orgId,
            userId,
            id,
            JSON.stringify({
              estado_anterior: estadoActual,
              nuevo_estado: 'documentos_pendientes',
              via: 'seleccionado_auto_advance',
            }),
          ]
        );
      } catch {
        console.error('Error logging activity for seleccionado auto-advance');
      }

      const updatedResult = await pool.query(
        `SELECT * FROM aplicaciones WHERE id = $1`,
        [id]
      );

      // Notificacion para seleccionado (early return path)
      try {
        const candidatoNombreSel = `${app.candidato_nombre} ${app.candidato_apellido || ''}`.trim();
        const vacanteIdSel = updatedResult.rows[0]?.vacante_id;
        const notifPipeline = await crearNotificacion({
          organizacionId: orgId,
          tipo: 'pipeline_estado_cambiado',
          titulo: 'Pipeline actualizado',
          mensaje: `${candidatoNombreSel} cambio a documentos_pendientes`,
          meta: { aplicacion_id: id, url: `/vacantes/${vacanteIdSel}/candidatos` },
        });
        if (notifPipeline) {
          emitirNotificacion(orgId, {
            type: 'notificacion',
            id: notifPipeline.id,
            tipo: 'pipeline_estado_cambiado',
            titulo: 'Pipeline actualizado',
            mensaje: `${candidatoNombreSel} cambio a documentos_pendientes`,
            browser_activo: notifPipeline.browser_activo,
            meta: { aplicacion_id: id, url: `/vacantes/${vacanteIdSel}/candidatos` },
            created_at: new Date().toISOString(),
          });
        }
        const notifSel = await crearNotificacion({
          organizacionId: orgId,
          tipo: 'candidato_seleccionado',
          titulo: 'Candidato seleccionado',
          mensaje: `${candidatoNombreSel} fue seleccionado`,
          meta: { aplicacion_id: id, url: `/vacantes/${vacanteIdSel}/candidatos` },
        });
        if (notifSel) {
          emitirNotificacion(orgId, {
            type: 'notificacion',
            id: notifSel.id,
            tipo: 'candidato_seleccionado',
            titulo: 'Candidato seleccionado',
            mensaje: `${candidatoNombreSel} fue seleccionado`,
            browser_activo: notifSel.browser_activo,
            meta: { aplicacion_id: id, url: `/vacantes/${vacanteIdSel}/candidatos` },
            created_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error('[notificacion] Error:', e);
      }

      return apiResponse(updatedResult.rows[0]);
    }

    // 5. Handle side effects for 'descartado'
    if (nuevoEstado === 'descartado') {
      // Send rejection email (non-blocking)
      try {
        if (app.candidato_email) {
          const candidatoNombre = `${app.candidato_nombre} ${app.candidato_apellido || ''}`.trim();

          // Check for custom rejection template
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
              textBody: `Estimado/a ${candidatoNombre}, agradecemos tu interes en ${app.vacante_titulo}. Hemos decidido continuar con otros candidatos.`,
            });
          } else {
            const emailData = emailRechazoTemplate({
              candidatoNombre,
              vacanteTitulo: app.vacante_titulo,
              empresaNombre: app.org_nombre,
              mensajePersonalizado: validated.motivo_descarte,
            });

            await sendEmail({
              to: app.candidato_email,
              subject: emailData.subject,
              htmlBody: emailData.htmlBody,
              textBody: emailData.textBody,
            });
          }
        }
      } catch (emailError) {
        console.error('[Estado] Error enviando email de rechazo:', emailError);
      }
    }

    // 5b. Handle side effects for 'contratado'
    let warningDobleContratacion: { tipo: string; vacantes: string } | null = null;
    let contratoEnviado = false;
    let contratoWarning: string | null = null;

    if (nuevoEstado === 'contratado') {
      const candidatoNombre = `${app.candidato_nombre} ${app.candidato_apellido || ''}`.trim();
      console.log('[CONTRATADO] Iniciando flujo — aplicacion:', id, 'candidato:', candidatoNombre);

      // Check double-hire
      try {
        const candidatoResult = await pool.query(
          `SELECT candidato_id FROM aplicaciones WHERE id = $1`, [id]
        );
        const candidatoId = candidatoResult.rows[0]?.candidato_id;
        if (candidatoId) {
          const yaContratado = await pool.query(
            `SELECT v.titulo FROM aplicaciones a
             JOIN vacantes v ON v.id = a.vacante_id
             WHERE a.candidato_id = $1 AND a.organization_id = $2
               AND a.estado = 'contratado' AND a.id != $3`,
            [candidatoId, orgId, id]
          );
          if (yaContratado.rows.length > 0) {
            warningDobleContratacion = {
              tipo: 'doble_contratacion',
              vacantes: yaContratado.rows.map((r: { titulo: string }) => r.titulo).join(', '),
            };
          }
        }
      } catch { /* non-blocking */ }

      // PASO 1: Enviar email de contratado al candidato — SIEMPRE, sin depender del contrato
      try {
        if (app.candidato_email) {
          // Obtener salario y fecha de la aplicacion
          const datosExtra = await pool.query(
            `SELECT salario_ofrecido, moneda, fecha_inicio_tentativa FROM aplicaciones WHERE id = $1`,
            [id]
          );
          const extra = datosExtra.rows[0] || {};
          const salarioFormateado = extra.salario_ofrecido
            ? `${extra.moneda || 'COP'} ${Number(extra.salario_ofrecido).toLocaleString('es-CO')}`
            : undefined;
          const fechaInicio = extra.fecha_inicio_tentativa
            ? new Date(extra.fecha_inicio_tentativa).toLocaleDateString('es-CO', {
                day: 'numeric', month: 'long', year: 'numeric',
              })
            : undefined;

          const emailData = emailContratadoTemplate({
            candidatoNombre,
            vacanteTitulo: app.vacante_titulo,
            empresaNombre: app.org_nombre,
            salario: salarioFormateado,
            fechaInicio,
          });

          await enviarEmail({
            to: app.candidato_email,
            subject: emailData.subject,
            html: emailData.htmlBody,
          });
          console.log('[CONTRATADO] Email enviado a:', app.candidato_email);
        } else {
          console.warn('[CONTRATADO] Candidato sin email, no se envio notificacion');
        }
      } catch (emailError) {
        console.error('[CONTRATADO] Error enviando email al candidato:', emailError);
        // No bloquear el flujo
      }

      // PASO 2: Crear contrato automatico (no bloquea si falla)
      try {
        const contratoExistente = await pool.query(
          `SELECT id, estado FROM contratos WHERE aplicacion_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [id]
        );
        let contratoId: string | null = contratoExistente.rows[0]?.id || null;

        if (!contratoId) {
          try {
            // Determinar tipo de contrato desde la vacante
            const vacanteTipoResult = await pool.query(
              `SELECT v.tipo_contrato FROM aplicaciones a JOIN vacantes v ON v.id = a.vacante_id WHERE a.id = $1`,
              [id]
            );
            const vacanteTipoRaw = vacanteTipoResult.rows[0]?.tipo_contrato || 'indefinido';
            // Buscar slug por nombre o slug exacto
            const tipoSlugResult = await pool.query(
              `SELECT slug FROM tipos_contrato WHERE slug = $1 OR LOWER(nombre) = LOWER($1) LIMIT 1`,
              [vacanteTipoRaw]
            );
            const tipo = tipoSlugResult.rows[0]?.slug || vacanteTipoRaw.toLowerCase().replace(/\s+/g, '_');

            const datos = await autoPoblarDatos(orgId, id, tipo);

            // Enriquecer con config_empresa si existe
            try {
              const orgConfig = await pool.query(
                `SELECT config_empresa FROM organizations WHERE id = $1`,
                [orgId]
              );
              const configEmpresa = orgConfig.rows[0]?.config_empresa || {};
              if (configEmpresa.nit) datos.empresa_nit = configEmpresa.nit;
              if (configEmpresa.representante_legal) datos.empresa_representante = configEmpresa.representante_legal;
              if (configEmpresa.direccion) datos.empresa_direccion = configEmpresa.direccion;
              if (configEmpresa.ciudad) datos.ciudad_contrato = configEmpresa.ciudad;
            } catch { /* non-blocking */ }

            // Buscar plantilla: primero en tabla de mapeo, luego por tipo directo
            let plantillaId: string | null = null;
            const mapeoResult = await pool.query(
              `SELECT m.plantilla_id FROM tipo_plantilla_mapeo m
               JOIN plantillas_contrato p ON p.id = m.plantilla_id AND p.is_active = true
               WHERE m.organization_id = $1 AND m.tipo_contrato_slug = $2 LIMIT 1`,
              [orgId, tipo]
            );
            if (mapeoResult.rows.length > 0) {
              plantillaId = mapeoResult.rows[0].plantilla_id;
            } else {
              const plantillaResult = await pool.query(
                `SELECT id FROM plantillas_contrato WHERE organization_id = $1 AND tipo = $2 AND is_active = true ORDER BY created_at DESC LIMIT 1`,
                [orgId, tipo]
              );
              plantillaId = plantillaResult.rows[0]?.id || null;
            }

            if (Object.keys(datos).length > 0) {
              const contrato = await createContrato(orgId, userId, {
                aplicacion_id: id,
                tipo,
                plantilla_id: plantillaId,
                datos: datos as import('@/lib/types/contrato.types').DatosContrato,
              });
              contratoId = contrato.id;
              contratoEnviado = false; // Contrato creado como borrador, admin revisa y envia
              console.log(`[CONTRATADO] Contrato creado como borrador: ${contratoId}`);
            }
          } catch (err) {
            console.error('[CONTRATADO] Error creando contrato:', err);
          }
        } else {
          console.log(`[CONTRATADO] Contrato ya existia: ${contratoId}`);
        }

        if (contratoId) {
          contratoWarning = null;
        } else {
          contratoWarning = 'No se pudo crear el contrato automaticamente. Crealo manualmente desde el modulo de Contratos.';
        }
      } catch (err) {
        console.error('[CONTRATADO] Error general en flujo contrato:', err);
        contratoWarning = 'Error procesando el contrato. Revisa el modulo de Contratos.';
      }
    }

    // 5c. Handle side effects for 'contrato_terminado'
    if (nuevoEstado === 'contrato_terminado') {
      const { motivo, motivo_detalle, fecha_terminacion, notas } = validated;
      if (!motivo || !fecha_terminacion) {
        return apiResponse({ error: 'Motivo y fecha de terminacion son requeridos' }, 422);
      }
      try {
        await pool.query(
          `INSERT INTO terminaciones_contrato
           (aplicacion_id, organization_id, motivo, motivo_detalle, fecha_terminacion, notas, creado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, orgId, motivo, motivo_detalle || null, fecha_terminacion, notas || null, userId]
        );
      } catch (err) {
        console.error('[Estado] Error registrando terminacion:', err);
      }
    }

    // 6. Update estado and estados_completados
    const result = await pool.query(
      `UPDATE aplicaciones
       SET estado = $1,
           estados_completados = $2,
           motivo_descarte = $3,
           updated_at = NOW()
       WHERE id = $4 AND organization_id = $5
       RETURNING *`,
      [
        nuevoEstado,
        nuevosEstadosCompletados,
        nuevoEstado === 'descartado' ? (validated.motivo_descarte || null) : null,
        id,
        orgId,
      ]
    );

    if (result.rowCount === 0) {
      return apiResponse({ error: 'Aplicacion no encontrada' }, 404);
    }

    // 7. Log activity
    try {
      await pool.query(
        `INSERT INTO activity_log (organization_id, user_id, entidad, entidad_id, accion, detalles)
         VALUES ($1, $2, 'aplicacion', $3, 'cambio_estado', $4)`,
        [
          orgId,
          userId,
          id,
          JSON.stringify({
            estado_anterior: estadoActual,
            nuevo_estado: nuevoEstado,
            motivo_descarte: validated.motivo_descarte || null,
          }),
        ]
      );
    } catch {
      console.error('Error logging activity for aplicacion estado change');
    }

    // Notificacion pipeline estado cambiado
    try {
      const candidatoNombreNotif = `${app.candidato_nombre} ${app.candidato_apellido || ''}`.trim();
      const vacanteIdNotif = result.rows[0]?.vacante_id;
      const notif = await crearNotificacion({
        organizacionId: orgId,
        tipo: 'pipeline_estado_cambiado',
        titulo: 'Pipeline actualizado',
        mensaje: `${candidatoNombreNotif} cambio a ${nuevoEstado}`,
        meta: { aplicacion_id: id, url: `/vacantes/${vacanteIdNotif}/candidatos` },
      });
      if (notif) {
        emitirNotificacion(orgId, {
          type: 'notificacion',
          id: notif.id,
          tipo: 'pipeline_estado_cambiado',
          titulo: 'Pipeline actualizado',
          mensaje: `${candidatoNombreNotif} cambio a ${nuevoEstado}`,
          browser_activo: notif.browser_activo,
          meta: { aplicacion_id: id, url: `/vacantes/${vacanteIdNotif}/candidatos` },
          created_at: new Date().toISOString(),
        });
      }

      // Additional notification for 'contratado'
      if (nuevoEstado === 'contratado') {
        const notifCont = await crearNotificacion({
          organizacionId: orgId,
          tipo: 'candidato_contratado',
          titulo: 'Candidato contratado',
          mensaje: `${candidatoNombreNotif} fue contratado`,
          meta: { aplicacion_id: id, url: `/vacantes/${vacanteIdNotif}/candidatos` },
        });
        if (notifCont) {
          emitirNotificacion(orgId, {
            type: 'notificacion',
            id: notifCont.id,
            tipo: 'candidato_contratado',
            titulo: 'Candidato contratado',
            mensaje: `${candidatoNombreNotif} fue contratado`,
            browser_activo: notifCont.browser_activo,
            meta: { aplicacion_id: id, url: `/vacantes/${vacanteIdNotif}/candidatos` },
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.error('[notificacion] Error:', e);
    }

    const responseData: Record<string, unknown> = { ...result.rows[0] };
    if (warningDobleContratacion) responseData.warning = warningDobleContratacion;
    if (nuevoEstado === 'contratado') {
      responseData.contratoCreado = !contratoWarning;
      responseData.contratoEnviado = contratoEnviado;
      responseData.contratoWarning = contratoWarning;
    }

    return apiResponse(responseData);
  } catch (error) {
    return apiError(error);
  }
}
