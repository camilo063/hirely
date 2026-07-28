import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { transicionarEstado } from '@/lib/services/pipeline-transicion.service';
import { verificarFirmaHmac, extraerFirma } from '@/lib/integrations/webhook-signature';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const verificacion = verificarFirmaHmac(
      rawBody,
      extraerFirma(request.headers),
      process.env.DOCUSIGN_WEBHOOK_SECRET
    );
    if (!verificacion.valido) {
      console.warn('[Webhook DocuSign] Rechazado:', verificacion.motivo);
      return apiResponse({ received: true, processed: false }, 401);
    }

    const body = JSON.parse(rawBody);
    console.log('[Webhook DocuSign] Received:', rawBody.substring(0, 500));

    const { envelope_id, event, completed_at } = body;

    if (!envelope_id) {
      return apiError(new Error('envelope_id requerido'));
    }

    // Find contrato by firma_external_id
    const contratoResult = await pool.query(
      'SELECT id, organization_id FROM contratos WHERE firma_external_id = $1',
      [envelope_id]
    );

    if (contratoResult.rows.length === 0) {
      console.log('[Webhook DocuSign] Contrato not found for envelope:', envelope_id);
      return apiResponse({ received: true, processed: false });
    }

    const { id, organization_id } = contratoResult.rows[0];

    if (event === 'completed' || event === 'signed') {
      await pool.query(
        `UPDATE contratos SET estado = 'firmado', firmado_at = $3, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2`,
        [id, organization_id, completed_at || new Date()]
      );

      // Also update aplicacion estado to contratado
      const contrato = await pool.query(
        'SELECT aplicacion_id FROM contratos WHERE id = $1',
        [id]
      );
      if (contrato.rows[0]?.aplicacion_id) {
        await transicionarEstado(contrato.rows[0].aplicacion_id, 'contratado', {
          orgId: organization_id,
        });
      }
    } else if (event === 'declined') {
      await pool.query(
        `UPDATE contratos SET estado = 'rechazado', updated_at = NOW()
        WHERE id = $1 AND organization_id = $2`,
        [id, organization_id]
      );
    }

    return apiResponse({ received: true, processed: true });
  } catch (error) {
    return apiError(error);
  }
}
