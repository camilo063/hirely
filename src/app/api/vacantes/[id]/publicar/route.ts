import { NextRequest } from 'next/server';
import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { getVacante, updateVacante } from '@/lib/services/vacantes.service';
import { publicarVacante } from '@/lib/services/portal-vacantes.service';
import { shareVacanteOnLinkedIn } from '@/lib/services/linkedin.service';
import { linkedInShareSchema } from '@/lib/validations/linkedin.schema';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const userId = await getUserId();
    const { id } = await params;

    const vacante = await getVacante(orgId, id);

    // Publish to portal (generate slug, mark as published)
    const portalResult = await publicarVacante(id, orgId);

    // Check if request has a body (LinkedIn share)
    const contentType = request.headers.get('content-type');
    let linkedinPost = null;

    if (contentType?.includes('application/json')) {
      const body = await request.json();
      const { content, visibility } = linkedInShareSchema.parse(body);
      linkedinPost = await shareVacanteOnLinkedIn(orgId, userId, id, content, visibility);
    }

    return apiResponse({
      vacante: { ...vacante, estado: 'publicada', slug: portalResult.slug },
      publicUrl: portalResult.publicUrl,
      linkedin: linkedinPost,
    });
  } catch (error) {
    return apiError(error);
  }
}
