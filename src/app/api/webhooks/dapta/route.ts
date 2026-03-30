import { NextRequest } from 'next/server';
import { procesarResultadoLlamada } from '@/lib/services/entrevista-ia.service';
import { createDaptaClient } from '@/lib/integrations/dapta.client';
import type { DaptaWebhookPayload } from '@/lib/types/entrevista.types';
import { pool } from '@/lib/db';
import { crearNotificacion } from '@/lib/services/notificaciones.service';
import { emitirNotificacion } from '@/lib/services/sse-clients';

/**
 * POST /api/webhooks/dapta
 *
 * Webhook that Dapta calls when an interview call ends.
 * Receives the transcript and call data.
 */
export async function POST(request: NextRequest) {
  const ts = new Date().toISOString();
  console.log(`\n═══ [Dapta Webhook] Recibido ${ts} ═══`);
  console.log('[Dapta Webhook] Method:', request.method);
  console.log('[Dapta Webhook] URL:', request.url);
  console.log('[Dapta Webhook] Headers:', JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));

  try {
    // 1. Verify webhook authenticity
    const daptaClient = createDaptaClient();
    if (daptaClient && !daptaClient.verifyWebhook(request.headers)) {
      console.log('[Dapta Webhook] ❌ Auth failed — invalid secret');
      return new Response('Unauthorized', { status: 401 });
    }
    console.log('[Dapta Webhook] ✅ Auth:', daptaClient ? 'verified' : 'skipped (no client)');

    // 2. Parse payload — Dapta may send data in various structures
    const rawBody = await request.text();
    console.log('[Dapta Webhook] Raw body (primeros 500 chars):', rawBody.substring(0, 500));

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error('[Dapta Webhook] ❌ JSON parse error:', parseErr);
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('[Dapta Webhook] Fields:', Object.keys(body));
    console.log('[Dapta Webhook] call_id:', body.call_id || body.id || body.execution_id || 'NOT FOUND');
    console.log('[Dapta Webhook] Status:', body.status || body.call_status || body.event || 'none');
    console.log('[Dapta Webhook] Transcript length:', (body.transcript || body.transcription || body.call_transcript || '').length);
    console.log('[Dapta Webhook] Metadata:', JSON.stringify(body.metadata || {}));
    console.log('[Dapta Webhook] Duration:', body.duration_seconds || body.duration || body.call_duration || 0);

    const payload: DaptaWebhookPayload = {
      call_id: body.call_id || body.id || body.execution_id || body.session_id || '',
      status: normalizeStatus(body.status || body.call_status || body.event || 'completed'),
      transcript: body.transcript || body.transcription || body.call_transcript || '',
      duration_seconds: body.duration_seconds || body.duration || body.call_duration || 0,
      from_number: body.from_number || body.from || '',
      to_number: body.to_number || body.to || '',
      started_at: body.started_at || body.start_time || new Date().toISOString(),
      ended_at: body.ended_at || body.end_time || new Date().toISOString(),
      recording_url: body.recording_url || body.recording || undefined,
      extracted_variables: body.extracted_variables || body.variables || undefined,
      agent_id: body.agent_id || undefined,
      campaign_id: body.campaign_id || undefined,
    };

    console.log('[Dapta Webhook] Normalized payload:', {
      call_id: payload.call_id,
      status: payload.status,
      transcript_length: payload.transcript.length,
      duration: payload.duration_seconds,
    });

    // 3. Extract entrevistaId from metadata
    const entrevistaId = body.metadata?.entrevista_id || body.entrevista_id || undefined;
    console.log('[Dapta Webhook] entrevistaId:', entrevistaId || 'NOT FOUND (will match by call_id)');

    // 4. Process
    console.log('[Dapta Webhook] Procesando resultado...');
    await procesarResultadoLlamada(payload, entrevistaId);
    console.log('[Dapta Webhook] ✅ Procesamiento completado');

    // Notificacion en tiempo real
    try {
      if (entrevistaId) {
        const entrevData = await pool.query(
          `SELECT ei.id, c.nombre as candidato_nombre, v.organization_id
           FROM entrevistas_ia ei
           JOIN aplicaciones a ON a.id = ei.aplicacion_id
           JOIN candidatos c ON c.id = a.candidato_id
           JOIN vacantes v ON v.id = a.vacante_id
           WHERE ei.id = $1`,
          [entrevistaId]
        );
        if (entrevData.rows.length > 0) {
          const ent = entrevData.rows[0];
          const notif = await crearNotificacion({
            organizacionId: ent.organization_id,
            tipo: 'entrevista_dapta_completada',
            titulo: 'Entrevista IA completada',
            mensaje: `Resultados disponibles para ${ent.candidato_nombre}`,
            meta: { entrevista_id: ent.id, url: '/entrevistas' },
          });
          if (notif) {
            emitirNotificacion(ent.organization_id, {
              type: 'notificacion',
              id: notif.id,
              tipo: 'entrevista_dapta_completada',
              titulo: 'Entrevista IA completada',
              mensaje: `Resultados disponibles para ${ent.candidato_nombre}`,
              browser_activo: notif.browser_activo,
              meta: { entrevista_id: ent.id, url: '/entrevistas' },
              created_at: new Date().toISOString(),
            });
          }
        }
      } else if (payload.call_id) {
        const entrevData = await pool.query(
          `SELECT ei.id, c.nombre as candidato_nombre, v.organization_id
           FROM entrevistas_ia ei
           JOIN aplicaciones a ON a.id = ei.aplicacion_id
           JOIN candidatos c ON c.id = a.candidato_id
           JOIN vacantes v ON v.id = a.vacante_id
           WHERE ei.dapta_call_id = $1`,
          [payload.call_id]
        );
        if (entrevData.rows.length > 0) {
          const ent = entrevData.rows[0];
          const notif = await crearNotificacion({
            organizacionId: ent.organization_id,
            tipo: 'entrevista_dapta_completada',
            titulo: 'Entrevista IA completada',
            mensaje: `Resultados disponibles para ${ent.candidato_nombre}`,
            meta: { entrevista_id: ent.id, url: '/entrevistas' },
          });
          if (notif) {
            emitirNotificacion(ent.organization_id, {
              type: 'notificacion',
              id: notif.id,
              tipo: 'entrevista_dapta_completada',
              titulo: 'Entrevista IA completada',
              mensaje: `Resultados disponibles para ${ent.candidato_nombre}`,
              browser_activo: notif.browser_activo,
              meta: { entrevista_id: ent.id, url: '/entrevistas' },
              created_at: new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      console.error('[notificacion] Error:', e);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Dapta Webhook] ❌ Error:', error?.message || error);
    console.error('[Dapta Webhook] Stack:', error?.stack);
    return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function normalizeStatus(status: string): DaptaWebhookPayload['status'] {
  const map: Record<string, DaptaWebhookPayload['status']> = {
    'completed': 'completed',
    'call_completed': 'completed',
    'success': 'completed',
    'done': 'completed',
    'failed': 'failed',
    'call_cancelled': 'failed',
    'error': 'failed',
    'no_answer': 'no_answer',
    'no-answer': 'no_answer',
    'busy': 'busy',
    'voicemail': 'voicemail',
  };
  return map[status.toLowerCase()] || 'failed';
}
