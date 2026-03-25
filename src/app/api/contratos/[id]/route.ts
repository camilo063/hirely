import { NextRequest } from 'next/server';
import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { getContrato, updateContrato } from '@/lib/services/contratos.service';
import { contratoUpdateSchema } from '@/lib/validations/contrato.schema';
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
    const contrato = await getContrato(orgId, id);

    // Resolve s3:// URLs to presigned download URLs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = contrato as any;
    if (c?.firma_pdf_url && typeof c.firma_pdf_url === 'string') {
      c.firma_pdf_url = await resolveUrl(c.firma_pdf_url);
    }

    return apiResponse(contrato);
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
    const userId = await getUserId();
    const { id } = await params;
    const body = await request.json();
    const validated = contratoUpdateSchema.parse(body);
    const contrato = await updateContrato(orgId, id, userId, validated);
    return apiResponse(contrato);
  } catch (error) {
    return apiError(error);
  }
}
