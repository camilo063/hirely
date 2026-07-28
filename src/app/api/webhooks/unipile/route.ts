import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { syncLinkedInApplicants } from '@/lib/services/linkedin-sync.service';
import { pool } from '@/lib/db';

/**
 * POST /api/webhooks/unipile
 *
 * Webhook endpoint for Unipile events (e.g. new job applicants).
 * Configure in Unipile dashboard: webhook URL → https://yourdomain.com/api/webhooks/unipile
 */
export const maxDuration = 30;

/**
 * Compara el secreto compartido en tiempo constante.
 *
 * El `!==` directo que habia aqui filtra por timing cuanto del secreto
 * coincide caracter a caracter — el unico de los 5 webhooks sin ninguna
 * proteccion de este tipo (los otros usan HMAC o, como dapta, una comparacion
 * manual constante). No se cambia a HMAC porque no hay documentacion de que
 * Unipile firme sus payloads asi; se iguala el mecanismo de secreto compartido
 * que ya usa, pero de forma segura.
 */
function secretosIguales(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = request.headers.get('x-webhook-secret');
    const secretoEsperado = process.env.UNIPILE_WEBHOOK_SECRET;
    if (!webhookSecret || !secretoEsperado || !secretosIguales(webhookSecret, secretoEsperado)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { event, data } = body;

    if (event === 'job.new_applicant' || event === 'job.applicant_update') {
      const unipileJobId = data?.job_id;
      if (!unipileJobId) {
        return NextResponse.json({ message: 'No job_id in event' }, { status: 200 });
      }

      const vacanteResult = await pool.query(
        `SELECT id, organization_id FROM vacantes WHERE linkedin_job_id = $1`,
        [unipileJobId]
      );

      if (vacanteResult.rows.length === 0) {
        return NextResponse.json({ message: 'Vacante not found for this job' }, { status: 200 });
      }

      const vacante = vacanteResult.rows[0];
      await syncLinkedInApplicants(vacante.id, vacante.organization_id, unipileJobId);

      return NextResponse.json({ message: 'Sync completed' }, { status: 200 });
    }

    return NextResponse.json({ message: 'Event not handled' }, { status: 200 });
  } catch (error) {
    console.error('[Unipile Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
