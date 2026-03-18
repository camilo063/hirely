import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

/**
 * Webhook receiver for firma providers (SignWell, DocuSign, etc.)
 *
 * Always returns 200 OK — even on internal errors — to prevent
 * the provider from retrying indefinitely.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Webhook Firma] Received:', JSON.stringify(body).substring(0, 500));

    // Determine event type and external ID from different providers
    let externalId: string | null = null;
    let eventType: string | null = null;
    let completedAt: string | null = null;

    // SignWell format
    if (body.document_id || body.id) {
      externalId = body.document_id || body.id;
      eventType = body.event_type || body.status || body.event;
      completedAt = body.completed_at ?? null;
    }

    // DocuSign / legacy format
    if (body.envelope_id) {
      externalId = body.envelope_id;
      eventType = body.event;
      completedAt = body.completed_at ?? null;
    }

    if (!externalId) {
      console.log('[Webhook Firma] No external ID found in payload');
      return Response.json({ received: true, processed: false }, { status: 200 });
    }

    // Find contrato
    const contratoResult = await pool.query(
      'SELECT id, organization_id, aplicacion_id FROM contratos WHERE firma_external_id = $1',
      [externalId]
    );

    if (contratoResult.rows.length === 0) {
      console.log(`[Webhook Firma] Contrato not found for external ID: ${externalId}`);
      return Response.json({ received: true, processed: false }, { status: 200 });
    }

    const { id, organization_id, aplicacion_id } = contratoResult.rows[0];

    // Process event
    const completedEvents = ['completed', 'signed', 'document.completed'];
    const declinedEvents = ['declined', 'voided', 'document.declined'];

    if (completedEvents.includes(eventType ?? '')) {
      await pool.query(
        `UPDATE contratos SET estado = 'firmado', firmado_at = $3, updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [id, organization_id, completedAt || new Date().toISOString()]
      );

      // Activity log
      await pool.query(
        `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
         VALUES ($1, 'contrato', $2, 'firmado', $3)`,
        [organization_id, id, JSON.stringify({ via: 'webhook', external_id: externalId })]
      );

      console.log(`[Webhook Firma] Contrato ${id} marcado como firmado`);
    } else if (declinedEvents.includes(eventType ?? '')) {
      await pool.query(
        `UPDATE contratos SET estado = 'rechazado', updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [id, organization_id]
      );

      await pool.query(
        `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
         VALUES ($1, 'contrato', $2, 'firma_rechazada', $3)`,
        [organization_id, id, JSON.stringify({ via: 'webhook', external_id: externalId })]
      );

      console.log(`[Webhook Firma] Contrato ${id} firma rechazada`);
    }

    return Response.json({ received: true, processed: true }, { status: 200 });
  } catch (error) {
    console.error('[Webhook Firma] Error processing:', error);
    // Always return 200 for webhooks
    return Response.json({ received: true, processed: false, error: 'Internal error' }, { status: 200 });
  }
}
