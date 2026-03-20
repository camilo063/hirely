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

      // Contract flow
      try {
        // 1. Check existing contract
        const contratoExistente = await pool.query(
          `SELECT id, estado FROM contratos WHERE aplicacion_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [id]
        );
        let contratoId: string | null = contratoExistente.rows[0]?.id || null;
        let contratoRecienCreado = false;

        // 2. If no contract, try to create one
        if (!contratoId) {
          try {
            const tipo = 'laboral';
            const datos = await autoPoblarDatos(orgId, id, tipo);
            if (Object.keys(datos).length > 0) {
              const contrato = await createContrato(orgId, userId, {
                aplicacion_id: id,
                tipo,
                datos: datos as import('@/lib/types/contrato.types').DatosContrato,
              });
              contratoId = contrato.id;
              contratoRecienCreado = true;
              console.log(`[CONTRATADO] Contrato creado: ${contratoId}`);
            }
          } catch (err) {
            console.error('[CONTRATADO] Error creando contrato:', err);
          }
        }

        // 3. Try to send for signature (any contract that exists and isn't already signed)
        if (contratoId) {
          const estadoContrato = contratoRecienCreado ? 'borrador' : (contratoExistente.rows[0]?.estado || 'borrador');
          if (['borrador', 'generado'].includes(estadoContrato)) {
            try {
              const firmaResult = await enviarParaFirma(orgId, contratoId);
              if (firmaResult.success) {
                contratoEnviado = true;
                console.log(`[CONTRATADO] Contrato enviado para firma`);
              } else {
                contratoWarning = `Contrato creado pero no se pudo enviar para firma: ${firmaResult.error}`;
                console.warn(`[CONTRATADO] ${contratoWarning}`);
              }
            } catch (firmaError) {
              contratoWarning = 'Contrato creado pero error al enviar para firma. Enviar manualmente desde Contratos.';
              console.error('[CONTRATADO] Error firma:', firmaError);
            }
          } else if (estadoContrato === 'enviado') {
            contratoEnviado = true; // already sent
          }
        } else {
          contratoWarning = 'No se pudo crear el contrato automaticamente. Crea y envia el contrato desde el modulo de Contratos.';
        }

        // 4. If contract couldn't be sent, notify admin
        if (!contratoEnviado && contratoWarning) {
          try {
            const adminResult = await pool.query(
              `SELECT email FROM users WHERE organization_id = $1 AND role = 'admin' AND is_active = true LIMIT 1`,
              [orgId]
            );
            if (adminResult.rows[0]) {
              await enviarEmail({
                to: adminResult.rows[0].email,
                subject: `Accion requerida: contrato pendiente para ${candidatoNombre}`,
                html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto"><div style="background:#0A1F3F;padding:24px;border-radius:8px 8px 0 0"><h2 style="color:white;margin:0">Candidato listo para contratacion</h2></div><div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px"><p style="color:#374151"><strong>${candidatoNombre}</strong> fue marcado como contratado para <strong>${app.vacante_titulo}</strong>.</p><p style="color:#374151">${contratoWarning}</p><p><a href="${process.env.NEXTAUTH_URL || ''}/contratos" style="display:inline-block;background:#00BCD4;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Ir a Contratos</a></p></div></div>`,
              });
            }
          } catch { /* non-blocking */ }
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

    const responseData: Record<string, unknown> = { ...result.rows[0] };
    if (warningDobleContratacion) responseData.warning = warningDobleContratacion;
    if (nuevoEstado === 'contratado') {
      responseData.contratoEnviado = contratoEnviado;
      responseData.contratoWarning = contratoWarning;
    }

    return apiResponse(responseData);
  } catch (error) {
    return apiError(error);
  }
}
