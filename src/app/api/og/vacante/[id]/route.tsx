import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';
import { pool } from '@/lib/db';
import { resolveUrl } from '@/lib/integrations/s3';

// Node.js runtime: project uses `pg` natively (no Edge adapter).
// `next/og` ImageResponse works in Node.js since Next 14.
export const runtime = 'nodejs';

const NAVY = '#0A1F3F';
const TEAL = '#00BCD4';
const ORANGE = '#FF6B35';
const GREEN = '#10B981';

const modalidadLabels: Record<string, string> = {
  remoto: 'Remoto',
  hibrido: 'Híbrido',
  presencial: 'Presencial',
};

interface PreparedLogo {
  src: string;
  width: number;
  height: number;
}

interface VacanteOGData {
  id: string;
  titulo: string;
  descripcion: string | null;
  departamento: string | null;
  ubicacion: string | null;
  modalidad: string | null;
  experiencia_minima: number | null;
  habilidades_requeridas: unknown;
  empresa_nombre: string;
  logo_url: string | null;
  logo: PreparedLogo | null;
}

const LOGO_MAX_HEIGHT = 72;
const LOGO_MAX_WIDTH = 260;

async function getVacanteForOG(id: string): Promise<VacanteOGData | null> {
  // UUID guard — avoid invalid_text_representation errors on malformed input
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  const result = await pool.query(
    `SELECT
       v.id, v.titulo, v.descripcion, v.departamento, v.ubicacion,
       v.modalidad, v.experiencia_minima, v.habilidades_requeridas,
       o.name AS empresa_nombre,
       COALESCE(os.portal_logo_url, o.logo_url) AS logo_url
     FROM vacantes v
     JOIN organizations o ON o.id = v.organization_id
     LEFT JOIN org_settings os ON os.organization_id = o.id
     WHERE v.id = $1 AND v.is_published = true AND v.estado = 'publicada'`,
    [id]
  );
  const row = result.rows[0];
  if (!row) return null;
  row.logo = row.logo_url ? await prepareLogoForOG(row.logo_url) : null;
  return row;
}

/**
 * Loads a logo as a data URL with its natural dimensions, scaled to fit
 * within LOGO_MAX_WIDTH × LOGO_MAX_HEIGHT preserving aspect ratio.
 *
 * Sources handled:
 *   - s3://...      → resolved to presigned URL, then fetched
 *   - /uploads/...  → read from local /public
 *   - http(s)://... → fetched over the network
 */
async function prepareLogoForOG(rawUrl: string): Promise<PreparedLogo | null> {
  try {
    let buffer: Buffer;
    let mime = 'image/png';

    if (rawUrl.startsWith('s3://')) {
      const presigned = await resolveUrl(rawUrl);
      const res = await fetch(presigned);
      if (!res.ok) return null;
      buffer = Buffer.from(await res.arrayBuffer());
      mime = res.headers.get('content-type') || mime;
    } else if (rawUrl.startsWith('/')) {
      const filePath = path.join(process.cwd(), 'public', rawUrl.replace(/^\//, ''));
      buffer = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      mime =
        ext === '.png' ? 'image/png' :
        ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
        ext === '.svg' ? 'image/svg+xml' : mime;
    } else {
      const res = await fetch(rawUrl);
      if (!res.ok) return null;
      buffer = Buffer.from(await res.arrayBuffer());
      mime = res.headers.get('content-type') || mime;
    }

    const dims = readImageDimensions(buffer);
    if (!dims) return null;

    const scale = Math.min(LOGO_MAX_WIDTH / dims.width, LOGO_MAX_HEIGHT / dims.height, 1);
    return {
      src: `data:${mime};base64,${buffer.toString('base64')}`,
      width: Math.max(1, Math.round(dims.width * scale)),
      height: Math.max(1, Math.round(dims.height * scale)),
    };
  } catch {
    return null;
  }
}

/**
 * Parse intrinsic image dimensions from a PNG or JPEG buffer.
 * Returns null for unsupported formats.
 */
function readImageDimensions(buf: Buffer): { width: number; height: number } | null {
  // PNG: signature 89 50 4E 47 0D 0A 1A 0A, then IHDR with width@16-19, height@20-23
  if (
    buf.length >= 24 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  ) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: starts with FF D8, scan for SOFn marker (FF C0–FF CF, except C4/C8/CC)
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = buf.readUInt16BE(i + 5);
        const width = buf.readUInt16BE(i + 7);
        return { width, height };
      }
      const segLen = buf.readUInt16BE(i + 2);
      i += 2 + segLen;
    }
  }
  return null;
}

function normalizeHabilidades(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((h) => (typeof h === 'string' ? h : h && typeof h === 'object' && 'name' in h ? String((h as { name: unknown }).name) : ''))
    .filter((s) => s.trim().length > 0);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function getTituloFontSize(titulo: string): number {
  if (titulo.length > 55) return 28;
  if (titulo.length > 40) return 30;
  return 36;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return await renderForVacante(params);
  } catch (err) {
    console.error('[og/vacante] render failed:', err);
    return renderFallback();
  }
}

async function renderForVacante(
  params: Promise<{ id: string }>
): Promise<ImageResponse> {
  const { id } = await params;
  const vacante = await getVacanteForOG(id);

  if (!vacante) {
    return renderFallback();
  }

  const titulo = truncate(vacante.titulo, 70);
  const tituloFontSize = getTituloFontSize(titulo);
  const descripcion = vacante.descripcion ? truncate(stripHtml(vacante.descripcion), 120) : '';
  const habilidades = normalizeHabilidades(vacante.habilidades_requeridas).slice(0, 6);
  const modalidadLabel = vacante.modalidad
    ? modalidadLabels[vacante.modalidad] || vacante.modalidad.charAt(0).toUpperCase() + vacante.modalidad.slice(1)
    : null;
  const experienciaLabel =
    vacante.experiencia_minima == null
      ? null
      : vacante.experiencia_minima === 0
        ? 'Sin experiencia'
        : `${vacante.experiencia_minima}+ años exp.`;
  const showSkillsColumn = habilidades.length > 0;
  const empresaInicial = vacante.empresa_nombre.charAt(0).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          position: 'relative',
          background: NAVY,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Texture layer: large soft teal bloom top-right */}
        <div
          style={{
            position: 'absolute',
            top: '-180px',
            right: '-180px',
            width: '560px',
            height: '560px',
            borderRadius: '50%',
            background: TEAL,
            opacity: 0.08,
          }}
        />
        {/* Texture layer: medium teal bloom mid-right */}
        <div
          style={{
            position: 'absolute',
            top: '180px',
            right: '60px',
            width: '320px',
            height: '320px',
            borderRadius: '50%',
            background: TEAL,
            opacity: 0.05,
          }}
        />
        {/* Texture layer: orange accent bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: '-160px',
            left: '-100px',
            width: '420px',
            height: '420px',
            borderRadius: '50%',
            background: ORANGE,
            opacity: 0.06,
          }}
        />
        {/* Texture layer: small teal accent top-left */}
        <div
          style={{
            position: 'absolute',
            top: '120px',
            left: '320px',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: TEAL,
            opacity: 0.04,
          }}
        />
        {/* Faint diagonal stripes overlay (built from many thin lines) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            background: `linear-gradient(135deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 24px, rgba(255,255,255,0.025) 24px, rgba(255,255,255,0.025) 25px, transparent 25px, transparent 48px)`,
          }}
        />
        {/* Decorative left bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '5px',
            background: `linear-gradient(to bottom, ${TEAL} 0%, ${TEAL} 60%, ${ORANGE} 100%)`,
          }}
        />
        {/* Decorative bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: `linear-gradient(to right, ${TEAL}, transparent)`,
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            padding: '48px 56px',
            width: '100%',
            height: '100%',
            gap: '48px',
          }}
        >
          {/* LEFT COLUMN */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* Top: logo only — natural aspect ratio, no white frame */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {vacante.logo ? (
                <img
                  src={vacante.logo.src}
                  width={vacante.logo.width}
                  height={vacante.logo.height}
                  style={{ objectFit: 'contain' }}
                />
              ) : (
                <span
                  style={{
                    color: '#ffffff',
                    fontSize: '24px',
                    fontWeight: 700,
                    letterSpacing: '-0.5px',
                  }}
                >
                  {empresaInicial}
                </span>
              )}
            </div>

            {/* Middle: badges + title + description */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                marginTop: 'auto',
                marginBottom: 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {vacante.departamento && (
                  <span
                    style={{
                      color: TEAL,
                      fontSize: '13px',
                      fontWeight: 600,
                      letterSpacing: '1.5px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {vacante.departamento}
                  </span>
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(16,185,129,0.12)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: '14px',
                    padding: '4px 12px',
                  }}
                >
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: GREEN,
                    }}
                  />
                  <span style={{ color: GREEN, fontSize: '11px', fontWeight: 600 }}>
                    Activa
                  </span>
                </div>
              </div>

              <div
                style={{
                  color: '#ffffff',
                  fontSize: `${tituloFontSize}px`,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: '-0.5px',
                  display: 'flex',
                }}
              >
                {titulo}
              </div>

              {descripcion && (
                <div
                  style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: '15px',
                    lineHeight: 1.5,
                    maxWidth: '95%',
                    display: 'flex',
                  }}
                >
                  {descripcion}
                </div>
              )}
            </div>

            {/* Bottom: metadata row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {vacante.ubicacion && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px', display: 'flex' }}>
                    📍 {vacante.ubicacion}
                  </span>
                  {(modalidadLabel || experienciaLabel) && (
                    <div
                      style={{
                        width: '1px',
                        height: '14px',
                        background: 'rgba(255,255,255,0.15)',
                      }}
                    />
                  )}
                </>
              )}
              {modalidadLabel && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px', display: 'flex' }}>
                    🌐 {modalidadLabel}
                  </span>
                  {experienciaLabel && (
                    <div
                      style={{
                        width: '1px',
                        height: '14px',
                        background: 'rgba(255,255,255,0.15)',
                      }}
                    />
                  )}
                </>
              )}
              {experienciaLabel && (
                <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px', display: 'flex' }}>
                  💼 {experienciaLabel}
                </span>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN — habilidades (only if any) */}
          {showSkillsColumn && (
            <div
              style={{
                width: '38%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              <span
                style={{
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '1.4px',
                  textTransform: 'uppercase',
                }}
              >
                Habilidades
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {habilidades.map((hab, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                    }}
                  >
                    <div
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: TEAL,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        color: 'rgba(255,255,255,0.88)',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      {truncate(hab, 38)}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: '10px',
                  background: ORANGE,
                  borderRadius: '8px',
                  padding: '12px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ color: '#ffffff', fontSize: '15px', fontWeight: 700 }}>
                  Postularme →
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control':
          'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  );
}

function renderFallback(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: NAVY,
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '5px',
            background: `linear-gradient(to bottom, ${TEAL} 0%, ${TEAL} 60%, ${ORANGE} 100%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: `linear-gradient(to right, ${TEAL}, transparent)`,
          }}
        />
        <div
          style={{
            color: TEAL,
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            marginBottom: '20px',
          }}
        >
          Hirely
        </div>
        <div
          style={{
            color: '#ffffff',
            fontSize: '40px',
            fontWeight: 800,
            letterSpacing: '-0.5px',
            textAlign: 'center',
            maxWidth: '900px',
            lineHeight: 1.2,
          }}
        >
          Vacante no disponible
        </div>
        <div
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: '18px',
            marginTop: '14px',
            textAlign: 'center',
          }}
        >
          Descubre más oportunidades laborales
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    }
  );
}
