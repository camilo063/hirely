import { NextResponse } from 'next/server';
import { isS3Configured, checkS3Health } from '@/lib/integrations/s3';

export async function GET(request: Request) {
  // Only allow in development or with internal key
  const isDev = process.env.NODE_ENV === 'development';
  const internalKey = request.headers.get('x-internal-key');
  const validKey = process.env.INTERNAL_API_KEY;

  if (!isDev && (!validKey || internalKey !== validKey)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  if (!isS3Configured) {
    return NextResponse.json({
      status: 'not_configured',
      message: 'S3 environment variables not set. Using local file storage.',
      provider: 'local',
    });
  }

  const result = await checkS3Health();

  return NextResponse.json(result, {
    status: result.status === 'ok' ? 200 : 500,
  });
}
