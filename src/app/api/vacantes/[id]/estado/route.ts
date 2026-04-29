import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { getVacante, updateVacante } from '@/lib/services/vacantes.service';
import { publishToLinkedIn, closeLinkedInJob, clearLinkedInJobId, getLinkedInMode } from '@/lib/services/linkedin-publish.service';
import { isValidTransition, getTransition } from '@/lib/services/vacancy-state-machine';
import type { VacancyEstado } from '@/lib/services/vacancy-state-machine';
import { apiResponse, apiError } from '@/lib/utils/api-response';

const estadoSchema = z.object({
  estado: z.enum(['borrador', 'publicada', 'pausada', 'cerrada', 'archivada']),
});

export const maxDuration = 10;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;

    const body = await request.json();
    const { estado: newEstado } = estadoSchema.parse(body);

    const vacante = await getVacante(orgId, id);
    const currentEstado = vacante.estado as VacancyEstado;

    if (!isValidTransition(currentEstado, newEstado)) {
      return apiResponse(
        { error: `Transicion invalida: ${currentEstado} -> ${newEstado}` },
        400
      );
    }

    const transition = getTransition(currentEstado, newEstado)!;
    let linkedinResult = null;
    let warning: string | undefined;

    // Execute LinkedIn side effect
    if (transition.linkedinAction === 'close') {
      const closeResult = await closeLinkedInJob(vacante);
      if (!closeResult.success) {
        warning = `Estado actualizado pero LinkedIn fallo: ${closeResult.error}`;
      }
    }

    if (transition.linkedinAction === 'publish') {
      // If reactivating from pausada, clear old linkedin_job_id first
      if (currentEstado === 'pausada') {
        await clearLinkedInJobId(vacante.id);
      }

      const configuredMode = getLinkedInMode();
      linkedinResult = await publishToLinkedIn(vacante);

      if (configuredMode === 'deeplink' && linkedinResult.mode === 'deeplink') {
        // Expected deeplink mode — estado changes, modal will show on client
      } else if (!linkedinResult.success || (configuredMode !== 'deeplink' && linkedinResult.mode === 'deeplink')) {
        // LinkedIn publish failed — do NOT change estado
        const errorDetail = linkedinResult.error
          || 'LinkedIn auto-publish fallo. Verifica la configuracion de Unipile/API.';
        return apiResponse({
          vacante,
          linkedinError: errorDetail,
        }, 200);
      }
    }

    // Update estado
    const updated = await updateVacante(orgId, id, { estado: newEstado });

    return apiResponse({
      vacante: updated,
      linkedin: linkedinResult,
      mode: linkedinResult?.mode || null,
      warning,
    });
  } catch (error) {
    return apiError(error);
  }
}
