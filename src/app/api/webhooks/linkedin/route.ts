import { NextRequest } from 'next/server';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Webhook LinkedIn] Received:', JSON.stringify(body));

    // TODO: Process LinkedIn webhook events
    // - New application received
    // - Job status changed
    // - Application status update

    return apiResponse({ received: true });
  } catch (error) {
    return apiError(error);
  }
}
