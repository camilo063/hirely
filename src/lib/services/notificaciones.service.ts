import { pool } from '@/lib/db';

// ---- TIPOS ----

export type TipoNotificacion =
  | 'vacante_publicada'
  | 'vacante_pausada'
  | 'vacante_limite_aplicantes'
  | 'nueva_aplicacion'
  | 'aplicacion_descartada'
  | 'score_ats_calculado'
  | 'pipeline_estado_cambiado'
  | 'entrevista_dapta_completada'
  | 'entrevista_humana_agendada'
  | 'entrevista_humana_realizada'
  | 'evaluacion_tecnica_completada'
  | 'candidato_seleccionado'
  | 'documento_subido'
  | 'documentos_completos'
  | 'documento_rechazado'
  | 'documento_aprobado'
  | 'portal_documentos_expirado'
  | 'contrato_generado'
  | 'contrato_enviado_firma'
  | 'contrato_firmado_candidato'
  | 'contrato_firmado_bilateral'
  | 'candidato_contratado'
  | 'onboarding_email_enviado'
  | 'candidato_duplicado_alerta'
  | 'contrato_terminado';

export interface CrearNotificacionParams {
  organizacionId: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  meta?: Record<string, string | number | boolean | null>;
  usuarioId?: string;
}

const CONFIG_DEFAULT: Record<TipoNotificacion, { inapp: boolean; browser: boolean; prioridad: string }> = {
  vacante_publicada:             { inapp: true,  browser: false, prioridad: 'media' },
  vacante_pausada:               { inapp: true,  browser: false, prioridad: 'baja'  },
  vacante_limite_aplicantes:     { inapp: true,  browser: true,  prioridad: 'media' },
  nueva_aplicacion:              { inapp: true,  browser: true,  prioridad: 'alta'  },
  aplicacion_descartada:         { inapp: true,  browser: false, prioridad: 'baja'  },
  score_ats_calculado:           { inapp: true,  browser: false, prioridad: 'media' },
  pipeline_estado_cambiado:      { inapp: true,  browser: true,  prioridad: 'alta'  },
  entrevista_dapta_completada:   { inapp: true,  browser: true,  prioridad: 'alta'  },
  entrevista_humana_agendada:    { inapp: true,  browser: true,  prioridad: 'alta'  },
  entrevista_humana_realizada:   { inapp: true,  browser: false, prioridad: 'media' },
  evaluacion_tecnica_completada: { inapp: true,  browser: true,  prioridad: 'alta'  },
  candidato_seleccionado:        { inapp: true,  browser: true,  prioridad: 'alta'  },
  documento_subido:              { inapp: true,  browser: false, prioridad: 'media' },
  documentos_completos:          { inapp: true,  browser: true,  prioridad: 'alta'  },
  documento_rechazado:           { inapp: true,  browser: false, prioridad: 'media' },
  documento_aprobado:            { inapp: true,  browser: false, prioridad: 'baja'  },
  portal_documentos_expirado:    { inapp: true,  browser: true,  prioridad: 'alta'  },
  contrato_generado:             { inapp: true,  browser: false, prioridad: 'media' },
  contrato_enviado_firma:        { inapp: true,  browser: true,  prioridad: 'alta'  },
  contrato_firmado_candidato:    { inapp: true,  browser: true,  prioridad: 'alta'  },
  contrato_firmado_bilateral:    { inapp: true,  browser: true,  prioridad: 'alta'  },
  candidato_contratado:          { inapp: true,  browser: true,  prioridad: 'alta'  },
  onboarding_email_enviado:      { inapp: true,  browser: false, prioridad: 'media' },
  candidato_duplicado_alerta:    { inapp: true,  browser: true,  prioridad: 'alta'  },
  contrato_terminado:            { inapp: true,  browser: false, prioridad: 'media' },
};

/**
 * Crea una notificacion respetando la config del admin.
 * NUNCA lanza excepcion — los efectos secundarios no deben romper el flujo principal.
 */
export async function crearNotificacion(params: CrearNotificacionParams): Promise<{ id: string; browser_activo: boolean } | null> {
  try {
    const { rows: configRows } = await pool.query(
      `SELECT inapp_activo, browser_activo FROM notificacion_config
       WHERE organization_id = $1 AND tipo = $2`,
      [params.organizacionId, params.tipo]
    );

    const defaults = CONFIG_DEFAULT[params.tipo];
    const inapp = configRows[0]?.inapp_activo ?? defaults.inapp;
    const browserActivo = configRows[0]?.browser_activo ?? defaults.browser;

    if (!inapp) return null;

    const { rows } = await pool.query(
      `INSERT INTO notificaciones (organization_id, usuario_id, tipo, titulo, mensaje, meta)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        params.organizacionId,
        params.usuarioId ?? null,
        params.tipo,
        params.titulo,
        params.mensaje,
        JSON.stringify(params.meta ?? {}),
      ]
    );

    return { id: rows[0].id, browser_activo: browserActivo };
  } catch (error) {
    console.error('[notificaciones.service] Error creando notificacion:', error);
    return null;
  }
}

export async function getConteoNoLeidas(organizacionId: string): Promise<number> {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int as total FROM notificaciones
       WHERE organization_id = $1 AND leida = false`,
      [organizacionId]
    );
    return rows[0]?.total ?? 0;
  } catch {
    return 0;
  }
}
