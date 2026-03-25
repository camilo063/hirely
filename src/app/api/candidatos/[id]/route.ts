import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { getCandidato, updateCandidato, deleteCandidato } from '@/lib/services/candidatos.service';
import { candidatoUpdateSchema } from '@/lib/validations/candidato.schema';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { resolveUrl } from '@/lib/integrations/s3';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    const candidato = await getCandidato(orgId, id);

    // Resolve s3:// cv_url to presigned download URL
    if (candidato?.cv_url) {
      candidato.cv_url = await resolveUrl(candidato.cv_url);
    }

    return apiResponse(candidato);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    const body = await request.json();
    const validated = candidatoUpdateSchema.parse(body);
    const candidato = await updateCandidato(orgId, id, validated);
    return apiResponse(candidato);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    await deleteCandidato(orgId, id);
    return apiResponse({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
