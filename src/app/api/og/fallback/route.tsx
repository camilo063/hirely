import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

const NAVY = '#0A1F3F';
const TEAL = '#00BCD4';
const ORANGE = '#FF6B35';

export async function GET() {
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
            marginBottom: '24px',
          }}
        >
          Hirely
        </div>
        <div
          style={{
            color: '#ffffff',
            fontSize: '52px',
            fontWeight: 800,
            letterSpacing: '-1px',
            textAlign: 'center',
            maxWidth: '900px',
            lineHeight: 1.1,
          }}
        >
          Descubre oportunidades laborales
        </div>
        <div
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: '20px',
            marginTop: '20px',
            textAlign: 'center',
            maxWidth: '760px',
          }}
        >
          Postúlate a las mejores vacantes en Hirely
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control':
          'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
      },
    }
  );
}
