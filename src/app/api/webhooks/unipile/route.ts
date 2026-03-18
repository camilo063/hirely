import { NextRequest, NextResponse } from 'next/server';
import { syncLinkedInApplicants } from '@/lib/services/linkedin-sync.service';
import { pool } from '@/lib/db';

/**
 * POST /api/webhooks/unipile
 *
 * Webhook endpoint for Unipile events (e.g. new job applicants).
 * Configure in Unipile dashboard: webhook URL → https://yourdomain.com/api/webhooks/unipile
 */
export async function POST(request: NextRequest) {
  try {
    const webhookSecret = request.headers.get('x-webhook-secret');
    if (webhookSecret !== process.env.UNIPILE_WEBHOOK_SECRET) {
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
