import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/middleware';
import { pool } from '@/lib/db';
import { getClients } from '@/lib/services/sse-clients';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const organizacionId = (session.user as { organizationId?: string }).organizationId;
  if (!organizacionId) {
    return new Response('Sin organizacion', { status: 403 });
  }

  let iniciales: object[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT id, tipo, titulo, mensaje, leida, meta, created_at
       FROM notificaciones
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [organizacionId]
    );
    iniciales = rows;
  } catch (e) {
    console.error('[SSE] Error cargando notificaciones iniciales:', e);
  }

  const clients = getClients();
  const encoder = new TextEncoder();
  let sendToClient: ((data: string) => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      sendToClient = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // stream cerrado
        }
      };

      if (!clients.has(organizacionId)) {
        clients.set(organizacionId, new Set());
      }
      clients.get(organizacionId)!.add(sendToClient);

      sendToClient(`data: ${JSON.stringify({ type: 'init', notificaciones: iniciales })}\n\n`);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        if (sendToClient) {
          clients.get(organizacionId)?.delete(sendToClient);
          if (clients.get(organizacionId)?.size === 0) {
            clients.delete(organizacionId);
          }
        }
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
