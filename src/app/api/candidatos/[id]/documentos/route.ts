import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { uploadDocumento } from '@/lib/services/onboarding.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export const maxDuration = 10;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id: candidatoId } = await params;

    const body = await request.json();
    const { tipo, nombre, url } = body;

    if (!tipo || !nombre || !url) {
      return apiError(new Error('tipo, nombre y url son requeridos'));
    }

    const documento = await uploadDocumento(orgId, candidatoId, tipo, nombre, url);
    return apiResponse(documento, 201);
  } catch (error) {
    return apiError(error);
  }
}
