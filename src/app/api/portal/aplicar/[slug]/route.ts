import { NextRequest, NextResponse } from 'next/server';
import { procesarAplicacionPortal } from '@/lib/services/portal-vacantes.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const formData = await request.formData();

    const nombre = formData.get('nombre') as string;
    const email = formData.get('email') as string;
    const telefono = formData.get('telefono') as string;

    if (!nombre || !email || !telefono) {
      return NextResponse.json(
        { success: false, error: 'Nombre, email y telefono son obligatorios' },
        { status: 400 }
      );
    }

    const cvFile = formData.get('cv') as File | null;
    if (!cvFile || cvFile.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Debes adjuntar tu hoja de vida' },
        { status: 400 }
      );
    }

    if (cvFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'El archivo no puede superar 10MB' },
        { status: 400 }
      );
    }

    const experienciaRaw = formData.get('experiencia_anos') as string;
    const habilidadesRaw = formData.get('habilidades') as string;
    let habilidades: string[] = [];
    try {
      habilidades = habilidadesRaw ? JSON.parse(habilidadesRaw) : [];
    } catch { /* ignore */ }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    const result = await procesarAplicacionPortal({
      vacanteSlug: slug,
      nombre,
      email,
      telefono,
      linkedinUrl: (formData.get('linkedin_url') as string) || undefined,
      ubicacion: (formData.get('ubicacion') as string) || undefined,
      experienciaAnos: experienciaRaw ? parseInt(experienciaRaw, 10) : undefined,
      nivelEducativo: (formData.get('nivel_educativo') as string) || undefined,
      habilidades,
      cvFile,
      cartaPresentacion: (formData.get('carta_presentacion') as string) || undefined,
      comoSeEntero: (formData.get('como_se_entero') as string) || undefined,
      referrerUrl: request.headers.get('referer') || undefined,
      ipAddress: ip,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      aplicacionId: result.aplicacionId,
    });
  } catch (error) {
    console.error('[Portal API] Error procesando aplicacion:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
