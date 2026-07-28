import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile, stat } from 'fs/promises';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';

/**
 * GET /api/archivos/{orgId}/{...ruta}
 *
 * Sirve los archivos del almacenamiento LOCAL detras de autenticacion.
 *
 * PROBLEMA QUE RESUELVE
 * En el modo local (sin S3) los adjuntos se escribian en `public/uploads/`, que
 * Next sirve de forma estatica: cualquiera con la URL descargaba CVs, cedulas y
 * certificados sin sesion. Añadir el `orgId` a la ruta hizo el enlace menos
 * adivinable, pero no lo protegio. Esta ruta si comprueba la sesion y que el
 * archivo pertenezca a la organizacion de quien pide.
 *
 * Con S3 configurado no se usa: alli los adjuntos se sirven con URLs firmadas.
 */
export const maxDuration = 15;

const BASE_UPLOADS = path.join(process.cwd(), '.uploads');
/** Ubicacion antigua: los archivos subidos antes del cambio siguen ahi. */
const BASE_UPLOADS_LEGACY = path.join(process.cwd(), 'public', 'uploads');

const TIPOS_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ruta: string[] }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { ruta } = await params;

    if (!orgId || !ruta || ruta.length < 2) {
      return new NextResponse('No encontrado', { status: 404 });
    }

    // La ruta es {entidad}/{orgId}/{...}: se exige que el segmento de
    // organizacion coincida con el de la sesion.
    const orgEnRuta = ruta[1];
    if (orgEnRuta !== orgId) {
      return new NextResponse('No encontrado', { status: 404 });
    }

    // El destino resuelto debe seguir cayendo dentro de uploads: sin esta
    // comprobacion, un `..` en la ruta leeria cualquier archivo del servidor.
    let destino: string | null = null;
    for (const base of [BASE_UPLOADS, BASE_UPLOADS_LEGACY]) {
      const candidato = path.resolve(base, ...ruta);
      if (candidato !== base && !candidato.startsWith(base + path.sep)) continue;
      const info = await stat(candidato).catch(() => null);
      if (info?.isFile()) { destino = candidato; break; }
    }

    if (!destino) {
      return new NextResponse('No encontrado', { status: 404 });
    }

    const contenido = await readFile(destino);
    const ext = path.extname(destino).toLowerCase();

    return new NextResponse(new Uint8Array(contenido), {
      headers: {
        'Content-Type': TIPOS_MIME[ext] || 'application/octet-stream',
        // `attachment` evita que un HTML/SVG guardado se ejecute en el dominio.
        'Content-Disposition': `attachment; filename="${path.basename(destino)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('No autorizado', { status: 401 });
  }
}
