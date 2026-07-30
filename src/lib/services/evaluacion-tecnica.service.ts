import crypto from 'crypto';
import { pool } from '@/lib/db';
import { getAppUrl } from '@/lib/utils/url';
import { seleccionarPreguntas } from './banco-preguntas.service';
import { calcularScoreEvaluacion } from './evaluacion-scoring.service';
import { crearNotificacion } from '@/lib/services/notificaciones.service';
import { transicionarEstado } from './pipeline-transicion.service';
import type {
  Evaluacion,
  EstructuraPlantilla,
  PreguntaAsignada,
  RespuestaCandidato,
} from '@/lib/types/evaluacion-tecnica.types';
import { NotFoundError, ValidationError, ConflictError } from '@/lib/utils/errors';
import { assertAplicacionDeOrg } from '@/lib/auth/authorization';
import { escaparHtml } from '@/lib/utils/escape-html';

/**
 * Orquestador de evaluaciones técnicas.
 *
 * Flujo:
 * 1. Reclutador selecciona plantilla o arma evaluación ad-hoc
 * 2. Sistema selecciona preguntas del banco (aleatorias según estructura)
 * 3. Se genera token único y se crea registro de evaluación
 * 4. Se envía notificación al candidato con link: /evaluacion/{token}
 * 5. Candidato responde (portal público, sin login)
 * 6. Al completar: scoring automático + actualizar score en aplicación
 */

export async function crearEvaluacion(data: {
  organization_id: string;
  aplicacion_id: string;
  candidato_id: string;
  vacante_id: string;
  plantilla_id?: string | null;
  titulo: string;
  duracion_minutos: number;
  puntaje_aprobatorio: number;
  preguntas?: PreguntaAsignada[];
  estructura?: EstructuraPlantilla[];
  asignado_por: string;
}): Promise<Evaluacion> {
  // La aplicacion llega del body. Sin esta comprobacion se podia crear una
  // evaluacion propia apuntando a la aplicacion de otra empresa: a partir de ahi
  // los GET filtraban el nombre y el email del candidato ajeno, el envio le
  // mandaba un correo con la marca del atacante, y al responderla se sobrescribia
  // su score_tecnico y su score_final (sabotaje del ranking).
  //
  // `candidato_id` y `vacante_id` se DERIVAN de la aplicacion verificada; los que
  // vengan en el body se ignoran a proposito.
  const aplicacion = await assertAplicacionDeOrg(data.aplicacion_id, data.organization_id);

  const token = crypto.randomBytes(32).toString('hex');

  // Select questions from banco.
  //
  // Si solo llega `plantilla_id`, la estructura se lee DE LA PLANTILLA. Antes se
  // exigia que el cliente la mandara ya derivada: la UI lo hacia, pero llamar a
  // la API con la plantilla —lo natural— devolvia 500.
  let estructura = data.estructura;
  if ((!data.preguntas || data.preguntas.length === 0) &&
      (!estructura || estructura.length === 0) &&
      data.plantilla_id) {
    const tpl = await pool.query(
      `SELECT estructura FROM evaluacion_plantillas WHERE id = $1 AND organization_id = $2`,
      [data.plantilla_id, data.organization_id]
    );
    if (tpl.rows.length === 0) {
      throw new NotFoundError('Plantilla de evaluación', data.plantilla_id);
    }
    const cruda = tpl.rows[0].estructura;
    estructura = typeof cruda === 'string' ? JSON.parse(cruda) : cruda;
  }

  let preguntas: PreguntaAsignada[];
  if (data.preguntas && data.preguntas.length > 0) {
    preguntas = data.preguntas;
  } else if (estructura && estructura.length > 0) {
    preguntas = await seleccionarPreguntas(data.organization_id, estructura);
  } else {
    throw new ValidationError(
      'Se requieren preguntas, una estructura o una plantilla con estructura para crear la evaluación'
    );
  }

  const puntajeTotal = preguntas.reduce((sum, p) => sum + p.puntos, 0);

  const result = await pool.query(
    `INSERT INTO evaluaciones (
      organization_id, aplicacion_id, candidato_id, vacante_id,
      plantilla_id, titulo, duracion_minutos, puntaje_total,
      puntaje_aprobatorio, preguntas, estado, token_acceso, asignado_por
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *`,
    [
      data.organization_id, aplicacion.id, aplicacion.candidato_id, aplicacion.vacante_id,
      data.plantilla_id || null, data.titulo, data.duracion_minutos, puntajeTotal,
      data.puntaje_aprobatorio, JSON.stringify(preguntas), 'pendiente', token,
      data.asignado_por,
    ]
  );

  return result.rows[0];
}

export async function enviarEvaluacion(evaluacionId: string, orgId: string): Promise<{ url: string }> {
  const result = await pool.query(
    `SELECT e.*, c.nombre as candidato_nombre, c.email as candidato_email, v.titulo as vacante_titulo
     FROM evaluaciones e
     JOIN candidatos c ON c.id = e.candidato_id AND c.organization_id = e.organization_id
     JOIN vacantes v ON v.id = e.vacante_id AND v.organization_id = e.organization_id
     WHERE e.id = $1 AND e.organization_id = $2`,
    [evaluacionId, orgId]
  );

  if (result.rows.length === 0) throw new NotFoundError('Evaluación', evaluacionId);
  const ev = result.rows[0];

  if (ev.estado !== 'pendiente' && ev.estado !== 'enviada') {
    throw new Error(`No se puede enviar una evaluación en estado: ${ev.estado}`);
  }

  const baseUrl = getAppUrl();
  const url = `${baseUrl}/evaluacion/${ev.token_acceso}`;
  const expiraAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

  await pool.query(
    `UPDATE evaluaciones SET
       estado = 'enviada',
       enviada_at = NOW(),
       token_expira_at = $1,
       updated_at = NOW()
     WHERE id = $2`,
    [expiraAt.toISOString(), evaluacionId]
  );

  // Send evaluation email to candidate
  const { enviarEmail } = await import('./email.service');
  const resultadoEnvio = await enviarEmail({
    to: ev.candidato_email,
    subject: `Evaluacion Tecnica — ${ev.vacante_titulo}`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0A1F3F; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Hirely</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #0A1F3F; margin-top: 0;">Hola, ${escaparHtml(ev.candidato_nombre)}!</h2>
          <p style="color: #374151; line-height: 1.6;">
            Te hemos asignado una evaluacion tecnica para la posicion de <strong>${escaparHtml(ev.vacante_titulo)}</strong>.
          </p>
          <p style="color: #374151; line-height: 1.6;">
            Tienes <strong>72 horas</strong> para completarla.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" style="background: #00BCD4; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Iniciar Evaluacion
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Este enlace expira el ${expiraAt.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>
        </div>
      </div>
    `,
    tags: { type: 'evaluacion_tecnica', evaluacion_id: evaluacionId },
  });

  // Si el proveedor rechazo el correo, el candidato no tiene forma de enterarse:
  // marcarla como 'enviada' dejaba al reclutador esperando una respuesta que no
  // iba a llegar. Se revierte el estado y se avisa.
  if (!resultadoEnvio.success) {
    // `token_expira_at` tambien se revierte: dejarlo con la caducidad recien
    // puesta era un dato huerfano de un envio que no ocurrio.
    await pool.query(
      `UPDATE evaluaciones SET estado = 'pendiente', token_expira_at = NULL, updated_at = NOW() WHERE id = $1`,
      [evaluacionId]
    );
    throw new Error('No se pudo enviar el correo de la evaluacion. Revisa la configuracion de correo.');
  }

  await pool.query(
    `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
     VALUES ($1, 'evaluacion', $2, 'enviada', $3)`,
    [orgId, evaluacionId, JSON.stringify({
      candidato: ev.candidato_nombre,
      email: ev.candidato_email,
      vacante: ev.vacante_titulo,
      url,
    })]
  );

  return { url };
}

export async function obtenerEvaluacionPorToken(token: string): Promise<{
  evaluacion: Evaluacion;
  candidato_nombre: string;
  vacante_titulo: string;
  empresa_nombre: string;
  tiempo_restante_segundos: number | null;
} | null> {
  const result = await pool.query(
    `SELECT e.*,
            c.nombre as candidato_nombre,
            v.titulo as vacante_titulo,
            o.name as empresa_nombre
     FROM evaluaciones e
     JOIN candidatos c ON c.id = e.candidato_id AND c.organization_id = e.organization_id
     JOIN vacantes v ON v.id = e.vacante_id AND v.organization_id = e.organization_id
     JOIN organizations o ON o.id = e.organization_id
     WHERE e.token_acceso = $1`,
    [token]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];

  // Check expiration
  if (row.token_expira_at && new Date(row.token_expira_at) < new Date()) {
    if (row.estado === 'enviada' || row.estado === 'en_progreso') {
      await pool.query(
        `UPDATE evaluaciones SET estado = 'expirada', updated_at = NOW() WHERE id = $1`,
        [row.id]
      );
      row.estado = 'expirada';
    }
  }

  // Calculate remaining time
  let tiempo_restante_segundos: number | null = null;
  if (row.iniciada_at && row.estado === 'en_progreso') {
    const iniciadaAt = new Date(row.iniciada_at).getTime();
    const duracionMs = row.duracion_minutos * 60 * 1000;
    const restante = Math.max(0, (iniciadaAt + duracionMs - Date.now()) / 1000);
    tiempo_restante_segundos = Math.floor(restante);
  }

  // Strip correct answers from questions for candidate view
  const preguntas = (typeof row.preguntas === 'string' ? JSON.parse(row.preguntas) : row.preguntas)
    .map((p: PreguntaAsignada) => ({
      ...p,
      opciones: p.opciones?.map(o => ({ id: o.id, texto: o.texto })) || null,
    }));

  // Proyeccion explicita para un endpoint PUBLICO.
  //
  // Antes se devolvia `{ ...row }` entero: el candidato recibia el
  // `token_acceso`, los ids internos (`organization_id`, `aplicacion_id`,
  // `candidato_id`, `vacante_id`, `asignado_por`) y los `eventos_seguridad`.
  // Peor: tras completarla devolvia `score_total`, `score_detalle`, `aprobada` y
  // sus propias `respuestas` IGNORANDO el flag `mostrar_resultados_al_candidato`,
  // que el POST si respeta.
  const mostrarResultados = row.mostrar_resultados_al_candidato === true;
  const completada = row.estado === 'completada';

  return {
    evaluacion: {
      id: row.id,
      titulo: row.titulo,
      estado: row.estado,
      duracion_minutos: row.duracion_minutos,
      puntaje_total: row.puntaje_total,
      puntaje_aprobatorio: row.puntaje_aprobatorio,
      enviada_at: row.enviada_at,
      iniciada_at: row.iniciada_at,
      completada_at: row.completada_at,
      token_expira_at: row.token_expira_at,
      preguntas,
      // Los resultados solo si la plantilla lo autoriza y ya termino.
      ...(completada && mostrarResultados
        ? {
            score_total: row.score_total,
            aprobada: row.aprobada,
            score_detalle: row.score_detalle,
          }
        : {}),
    } as Evaluacion,
    candidato_nombre: row.candidato_nombre,
    vacante_titulo: row.vacante_titulo,
    empresa_nombre: row.empresa_nombre,
    tiempo_restante_segundos,
  };
}

export async function iniciarEvaluacion(token: string): Promise<void> {
  const result = await pool.query(
    `UPDATE evaluaciones SET
       estado = 'en_progreso',
       iniciada_at = NOW(),
       updated_at = NOW()
     WHERE token_acceso = $1 AND estado = 'enviada'
     RETURNING id`,
    [token]
  );
  if (result.rows.length === 0) {
    throw new Error('No se puede iniciar la evaluación. Estado inválido o token incorrecto.');
  }
}

export async function guardarRespuestas(
  token: string,
  respuestas: RespuestaCandidato[]
): Promise<{ score: number; aprobada: boolean; detalle: Record<string, unknown>; mostrar_resultados: boolean }> {
  // Get evaluation with correct answers.
  //
  // El estado, la expiracion del token y el cronometro se validan AQUI, en el
  // servidor. Antes solo se exigia el estado: la caducidad se comprobaba en el
  // GET (que el candidato puede simplemente no llamar) y el limite de tiempo era
  // puramente visual. Se podia responder con el token vencido hacia semanas, o
  // saltarse el cronometro entero enviando sin pasar por "iniciar".
  const evResult = await pool.query(
    `SELECT e.*, ep.mostrar_resultados_al_candidato
     FROM evaluaciones e
     LEFT JOIN evaluacion_plantillas ep ON ep.id = e.plantilla_id
     WHERE e.token_acceso = $1
       AND e.estado = 'en_progreso'
       AND (e.token_expira_at IS NULL OR e.token_expira_at > NOW())
       AND e.iniciada_at IS NOT NULL
       AND e.iniciada_at + (e.duracion_minutos * interval '1 minute') > NOW()`,
    [token]
  );

  if (evResult.rows.length === 0) {
    throw new Error('Evaluación no encontrada, ya completada, expirada o fuera de tiempo');
  }

  const ev = evResult.rows[0];
  const preguntasSnapshot = typeof ev.preguntas === 'string' ? JSON.parse(ev.preguntas) : ev.preguntas;

  // Get original questions from banco for correct answers
  const preguntaIds = preguntasSnapshot.map((p: PreguntaAsignada) => p.pregunta_id);
  const { obtenerPreguntasConRespuestas } = await import('./banco-preguntas.service');
  const preguntasOriginales = await obtenerPreguntasConRespuestas(preguntaIds);

  // Build full questions with correct answers for scoring
  const preguntasConRespuesta = preguntasSnapshot.map((p: PreguntaAsignada) => {
    const original = preguntasOriginales.get(p.pregunta_id);
    return {
      ...p,
      opciones: original?.opciones || p.opciones,
      respuesta_correcta: original?.respuesta_correcta || null,
      explicacion: original?.explicacion || null,
    };
  });

  // Calculate score
  const resultado = await calcularScoreEvaluacion(
    preguntasConRespuesta,
    respuestas,
    ev.puntaje_aprobatorio
  );

  // Save results
  await pool.query(
    `UPDATE evaluaciones SET
       estado = 'completada',
       respuestas = $1,
       score_total = $2,
       score_detalle = $3,
       aprobada = $4,
       completada_at = NOW(),
       updated_at = NOW()
     WHERE id = $5`,
    [
      JSON.stringify(respuestas),
      resultado.score_total,
      JSON.stringify(resultado.detalle),
      resultado.aprobada,
      ev.id,
    ]
  );

  // Update application score_tecnico
  await pool.query(
    `UPDATE aplicaciones SET
       score_tecnico = $1,
       evaluacion_tecnica_id = $2,
       updated_at = NOW()
     WHERE id = $3`,
    [resultado.score_total, ev.id, ev.aplicacion_id]
  );

  // Recalculate score_final with all available components
  try {
    const { recalcularScoreFinal } = await import('./scoring-dual.service');
    await recalcularScoreFinal(ev.aplicacion_id);
  } catch (err) {
    console.error('[Evaluacion Tecnica] Error recalculando score_final:', err);
  }

  // Completar la prueba tecnica deja al candidato en el estado "Prueba técnica"
  // (key 'prueba_tecnica', distinto de 'entrevista_ia' desde la migracion 038 —
  // ese key es exclusivo de la llamada telefonica con Dapta). El estado
  // 'evaluado' ("A evaluar") es posterior a la Entrevista Humana y captura la
  // evaluación humana, no la técnica. Se incluye 'entrevista_ia' en el origen
  // porque muchas organizaciones no usan Dapta y llegan directo desde
  // 'preseleccionado'; las que si lo usan tambien pueden avanzar desde ahi.
  await transicionarEstado(ev.aplicacion_id, 'prueba_tecnica', {
    soloDesde: ['nuevo', 'en_revision', 'revisado', 'preseleccionado', 'entrevista_ia'],
    orgId: ev.organization_id,
  });

  // Activity log
  await pool.query(
    `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
     VALUES ($1, 'evaluacion', $2, 'completada', $3)`,
    [ev.organization_id, ev.id, JSON.stringify({
      score: resultado.score_total,
      aprobada: resultado.aprobada,
    })]
  );

  // Notificacion en tiempo real
  try {
    const candInfoNotif = await pool.query(
      `SELECT c.nombre as candidato_nombre FROM candidatos c WHERE c.id = $1`,
      [ev.candidato_id]
    );
    const candNombreNotif = candInfoNotif.rows[0]?.candidato_nombre || 'Candidato';
    await crearNotificacion({
      organizacionId: ev.organization_id,
      tipo: 'evaluacion_tecnica_completada',
      titulo: 'Evaluacion tecnica completada',
      mensaje: `${candNombreNotif} completo la evaluacion`,
      meta: { evaluacion_id: ev.id, url: `/evaluaciones/${ev.id}` },
    });
  } catch (e) {
    console.error('[notificacion] Error:', e);
  }

  // Notify admin(s) about completed technical evaluation
  try {
    const adminResult = await pool.query(
      `SELECT email FROM users WHERE organization_id = $1 AND role IN ('admin') AND is_active = true`,
      [ev.organization_id]
    );
    const adminEmails = adminResult.rows.map((r: { email: string }) => r.email);

    if (adminEmails.length > 0) {
      const { enviarEmail } = await import('./email.service');
      const { emailNotificacionEvaluacion } = await import('@/lib/utils/email-templates');

      // Get candidate and vacancy info for the notification
      const infoResult = await pool.query(
        `SELECT c.nombre as candidato_nombre, v.titulo as vacante_titulo
         FROM evaluaciones e
         JOIN candidatos c ON c.id = e.candidato_id
         JOIN vacantes v ON v.id = e.vacante_id
         WHERE e.id = $1`,
        [ev.id]
      );
      const info = infoResult.rows[0];

      if (info) {
        const baseUrl = getAppUrl();
        const dashboardUrl = `${baseUrl}/evaluaciones`;

        const { subject, htmlBody } = emailNotificacionEvaluacion({
          candidatoNombre: info.candidato_nombre,
          vacanteTitulo: info.vacante_titulo,
          scoreTecnico: resultado.score_total,
          puntajeAprobatorio: ev.puntaje_aprobatorio,
          aprobada: resultado.aprobada,
          dashboardUrl,
        });

        await enviarEmail({
          to: adminEmails,
          subject,
          html: htmlBody,
          tags: { type: 'notificacion_evaluacion', evaluacion_id: ev.id },
        });
      }
    }
  } catch (emailError) {
    console.error(`[Evaluacion Tecnica] Error enviando notificación email para evaluación ${ev.id}:`, emailError);
  }

  return {
    score: resultado.score_total,
    aprobada: resultado.aprobada,
    detalle: resultado.detalle,
    mostrar_resultados: ev.mostrar_resultados_al_candidato || false,
  };
}

// ─── CRUD for dashboard ───

export async function listarEvaluaciones(orgId: string, filters?: {
  vacante_id?: string;
  estado?: string;
}): Promise<Evaluacion[]> {
  const conditions = ['e.organization_id = $1'];
  const params: unknown[] = [orgId];
  let idx = 2;

  if (filters?.vacante_id) {
    conditions.push(`e.vacante_id = $${idx++}`);
    params.push(filters.vacante_id);
  }
  if (filters?.estado) {
    conditions.push(`e.estado = $${idx++}`);
    params.push(filters.estado);
  }

  const result = await pool.query(
    `SELECT e.*,
            c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
            v.titulo as vacante_titulo
     FROM evaluaciones e
     JOIN candidatos c ON c.id = e.candidato_id AND c.organization_id = e.organization_id
     JOIN vacantes v ON v.id = e.vacante_id AND v.organization_id = e.organization_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.created_at DESC`,
    params
  );

  return result.rows;
}

export async function obtenerEvaluacion(id: string, orgId: string): Promise<Evaluacion> {
  const result = await pool.query(
    `SELECT e.*,
            c.nombre as candidato_nombre, c.apellido as candidato_apellido, c.email as candidato_email,
            v.titulo as vacante_titulo
     FROM evaluaciones e
     JOIN candidatos c ON c.id = e.candidato_id AND c.organization_id = e.organization_id
     JOIN vacantes v ON v.id = e.vacante_id AND v.organization_id = e.organization_id
     WHERE e.id = $1 AND e.organization_id = $2`,
    [id, orgId]
  );

  if (result.rows.length === 0) throw new NotFoundError('Evaluación', id);
  const evaluacion = result.rows[0];

  // Enriquecer el snapshot con las respuestas correctas REALES.
  //
  // Las preguntas se guardan con `es_correcta: false` en TODAS las opciones —
  // correcto para el candidato, pero esta funcion sirve la vista del RECLUTADOR:
  // al revisar una prueba terminada veia todas las opciones marcadas como
  // incorrectas, incluidas las que el candidato acerto. El scoring nunca estuvo
  // mal (relee el banco), solo la revision.
  try {
    const snapshot: PreguntaAsignada[] =
      typeof evaluacion.preguntas === 'string'
        ? JSON.parse(evaluacion.preguntas)
        : evaluacion.preguntas || [];

    if (snapshot.length > 0) {
      const { obtenerPreguntasConRespuestas } = await import('./banco-preguntas.service');
      const originales = await obtenerPreguntasConRespuestas(snapshot.map((p) => p.pregunta_id));

      evaluacion.preguntas = snapshot.map((p) => {
        const original = originales.get(p.pregunta_id);
        if (!original) return p;
        return {
          ...p,
          opciones: original.opciones ?? p.opciones,
          respuesta_correcta: original.respuesta_correcta ?? null,
          explicacion: original.explicacion ?? null,
        };
      });
    }
  } catch (error) {
    // Si el banco no resuelve, se devuelve el snapshot tal cual: es preferible
    // mostrar la evaluacion sin marcar aciertos que no mostrarla.
    console.error('[Evaluacion] No se pudieron recuperar las respuestas correctas:', error);
  }

  return evaluacion;
}

export async function cancelarEvaluacion(id: string, orgId: string): Promise<void> {
  // Se comprueba existencia/pertenencia y estado por separado para poder
  // distinguir 404 (no existe o es de otra organizacion) de 409 (existe pero
  // ya no esta en un estado cancelable): un UPDATE con ambas condiciones en el
  // WHERE no permite diferenciar los dos casos a partir de `rowCount === 0`.
  const actual = await pool.query(
    `SELECT estado FROM evaluaciones WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
  if (actual.rows.length === 0) throw new NotFoundError('Evaluación', id);
  if (!['pendiente', 'enviada'].includes(actual.rows[0].estado)) {
    throw new ConflictError(`No se puede cancelar una evaluación en estado: ${actual.rows[0].estado}`);
  }

  await pool.query(
    `UPDATE evaluaciones SET estado = 'cancelada', updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
}

// ─── Plantillas CRUD ───

export async function listarPlantillas(orgId: string): Promise<import('@/lib/types/evaluacion-tecnica.types').EvaluacionPlantilla[]> {
  const result = await pool.query(
    `SELECT * FROM evaluacion_plantillas
     WHERE organization_id = $1 AND estado != 'archivada'
     ORDER BY created_at DESC`,
    [orgId]
  );
  return result.rows;
}

export async function crearPlantilla(
  orgId: string,
  data: Partial<import('@/lib/types/evaluacion-tecnica.types').EvaluacionPlantilla>,
  creadoPor: string
): Promise<import('@/lib/types/evaluacion-tecnica.types').EvaluacionPlantilla> {
  const result = await pool.query(
    `INSERT INTO evaluacion_plantillas (
      organization_id, nombre, descripcion, duracion_minutos,
      puntaje_total, puntaje_aprobatorio, aleatorizar_preguntas,
      mostrar_resultados_al_candidato, estructura, cargos_sugeridos,
      tags, estado, creado_por
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *`,
    [
      orgId, data.nombre, data.descripcion || null, data.duracion_minutos || 60,
      data.puntaje_total || 100, data.puntaje_aprobatorio || 70,
      data.aleatorizar_preguntas ?? true, data.mostrar_resultados_al_candidato ?? false,
      JSON.stringify(data.estructura || []), data.cargos_sugeridos || [],
      data.tags || [], data.estado || 'activa', creadoPor,
    ]
  );
  return result.rows[0];
}

export async function obtenerPlantilla(id: string, orgId: string): Promise<import('@/lib/types/evaluacion-tecnica.types').EvaluacionPlantilla> {
  const result = await pool.query(
    'SELECT * FROM evaluacion_plantillas WHERE id = $1 AND organization_id = $2',
    [id, orgId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Plantilla', id);
  return result.rows[0];
}

export async function actualizarPlantilla(
  id: string,
  orgId: string,
  data: Partial<import('@/lib/types/evaluacion-tecnica.types').EvaluacionPlantilla>
): Promise<import('@/lib/types/evaluacion-tecnica.types').EvaluacionPlantilla> {
  const fields: string[] = [];
  const params: unknown[] = [id, orgId];
  let idx = 3;

  const map: Record<string, (v: unknown) => unknown> = {
    nombre: v => v, descripcion: v => v, duracion_minutos: v => v,
    puntaje_total: v => v, puntaje_aprobatorio: v => v,
    aleatorizar_preguntas: v => v, mostrar_resultados_al_candidato: v => v,
    estructura: v => JSON.stringify(v), cargos_sugeridos: v => v,
    tags: v => v, estado: v => v,
  };

  for (const [key, transform] of Object.entries(map)) {
    if ((data as Record<string, unknown>)[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      params.push(transform((data as Record<string, unknown>)[key]));
    }
  }

  if (fields.length === 0) return obtenerPlantilla(id, orgId);
  fields.push('updated_at = NOW()');

  const result = await pool.query(
    `UPDATE evaluacion_plantillas SET ${fields.join(', ')} WHERE id = $1 AND organization_id = $2 RETURNING *`,
    params
  );
  if (result.rows.length === 0) throw new NotFoundError('Plantilla', id);
  return result.rows[0];
}
