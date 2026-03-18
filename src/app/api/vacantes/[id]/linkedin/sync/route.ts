import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { getVacante } from '@/lib/services/vacantes.service';
import { syncLinkedInApplicants } from '@/lib/services/linkedin-sync.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { ValidationError } from '@/lib/utils/errors';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;

    const vacante = await getVacante(orgId, id);

    if (!vacante.linkedin_job_id) {
      throw new ValidationError('Esta vacante no ha sido publicada en LinkedIn');
    }

    const result = await syncLinkedInApplicants(vacante.id, orgId, vacante.linkedin_job_id);

    return apiResponse({
      ...result,
      message: result.nuevos > 0
        ? `${result.nuevos} nuevo(s) candidato(s) importado(s) desde LinkedIn`
        : 'No hay nuevos candidatos desde LinkedIn',
    });
  } catch (error) {
    return apiError(error);
  }
}
