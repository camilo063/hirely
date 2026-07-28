import { NextRequest, NextResponse } from 'next/server';
import { procesarAplicacionPortal } from '@/lib/services/portal-vacantes.service';
import { rateLimit, ipDeRequest, respuesta429 } from '@/lib/utils/rate-limit';

export const maxDuration = 15;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    // Cada postulacion dispara parseo de CV y scoring con Claude: sin freno,
    // un bucle se traduce en coste directo en la factura de IA.
    const rl = await rateLimit({ clave: `aplicar:ip:${ipDeRequest(request)}`, limite: 5, ventanaSegundos: 3600 });
    if (!rl.permitido) {
      return respuesta429(rl.reintentarEn, 'Has enviado demasiadas postulaciones. Intenta mas tarde.');
    }

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

    // Segundo freno, por email y vacante. La cabecera X-Forwarded-For la
    // controla el cliente en un despliegue autoalojado, asi que el limite por IP
    // se elude rotandola; el email no es falsificable de la misma forma y ademas
    // es la clave real del abuso (una misma persona postulandose en bucle).
    const rlEmail = await rateLimit({
      clave: `aplicar:email:${email.trim().toLowerCase()}:${slug}`,
      limite: 3,
      ventanaSegundos: 86400,
    });
    if (!rlEmail.permitido) {
      return respuesta429(rlEmail.reintentarEn, 'Ya registramos tu postulacion. Te contactaremos pronto.');
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

    // El tipo se valida AQUI, antes de crear nada. `saveFile` (mas abajo, dentro
    // de `procesarAplicacionPortal`) tambien lo valida, pero para entonces ya se
    // inserto el candidato: un tipo invalido dejaba creada la aplicacion SIN CV
    // y sin ningun aviso, porque ese `saveFile` esta envuelto en un try/catch que
    // solo loguea.
    const extension = cvFile.name.slice(cvFile.name.lastIndexOf('.')).toLowerCase();
    const EXTENSIONES_CV_VALIDAS = ['.pdf', '.doc', '.docx'];
    if (!EXTENSIONES_CV_VALIDAS.includes(extension)) {
      return NextResponse.json(
        { success: false, error: `Formato no permitido. Usa ${EXTENSIONES_CV_VALIDAS.join(', ')}.` },
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
