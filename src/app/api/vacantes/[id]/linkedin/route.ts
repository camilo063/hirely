import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { getVacante } from '@/lib/services/vacantes.service';
import { publishToLinkedIn, getLinkedInMode } from '@/lib/services/linkedin-publish.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { ValidationError } from '@/lib/utils/errors';

export const maxDuration = 30;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;

    const vacante = await getVacante(orgId, id);

    if (vacante.estado === 'cerrada') {
      throw new ValidationError('No se puede publicar una vacante cerrada');
    }

    const result = await publishToLinkedIn(vacante);
    return apiResponse(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;

    const vacante = await getVacante(orgId, id);

    return apiResponse({
      mode: getLinkedInMode(),
      linkedinJobId: vacante.linkedin_job_id,
      isPublished: !!vacante.linkedin_job_id,
      estado: vacante.estado,
    });
  } catch (error) {
    return apiError(error);
  }
}
