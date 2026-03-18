import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { parseCVFromPDF, parseCVFromLinkedIn } from '@/lib/services/cv-parser.service';
import { pdfUrlToBase64, pdfBufferToBase64 } from '@/lib/utils/pdf-extract';
import { pool } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils/api-response';

/**
 * POST /api/candidatos/[id]/parse-cv
 *
 * Trigger manual de parsing de CV.
 * - Si el candidato tiene cv_url, descarga y parsea el PDF
 * - Si se envia un archivo en el body (multipart), parsea ese PDF
 * - Si no tiene PDF, intenta construir datos desde LinkedIn/datos existentes
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id: candidatoId } = await params;

    // Check if multipart file upload
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('cv') as File | null;

      if (!file) {
        return apiError(new Error('No se envio archivo de CV'));
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfBase64 = pdfBufferToBase64(buffer);
      const result = await parseCVFromPDF(pdfBase64, candidatoId, orgId);

      return apiResponse({
        parsed: true,
        fuente: 'pdf',
        confianza: result.confianza,
        resumen: result.resumen_profesional,
      });
    }

    // No file uploaded — try existing cv_url or LinkedIn data
    const candidatoResult = await pool.query(
      `SELECT cv_url, fuente FROM candidatos WHERE id = $1 AND organization_id = $2`,
      [candidatoId, orgId]
    );

    if (candidatoResult.rows.length === 0) {
      return apiError(new Error('Candidato no encontrado'));
    }

    const candidato = candidatoResult.rows[0];

    if (candidato.cv_url) {
      const pdfBase64 = await pdfUrlToBase64(candidato.cv_url);
      const result = await parseCVFromPDF(pdfBase64, candidatoId, orgId);

      return apiResponse({
        parsed: true,
        fuente: 'pdf',
        confianza: result.confianza,
        resumen: result.resumen_profesional,
      });
    }

    // Fallback to LinkedIn data parsing
    const result = await parseCVFromLinkedIn(candidatoId, orgId);

    return apiResponse({
      parsed: true,
      fuente: result.fuente,
      confianza: result.confianza,
      resumen: result.resumen_profesional,
    });
  } catch (error) {
    return apiError(error);
  }
}
