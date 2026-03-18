import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MapPin, Briefcase, GraduationCap, Clock, Building, DollarSign, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getVacantePublica } from '@/lib/services/portal-vacantes.service';
import { AplicacionFormWrapper } from '@/components/portal/aplicacion-form-wrapper';

// SEO metadata
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const vacante = await getVacantePublicaForMeta(slug);
  if (!vacante) return { title: 'Vacante no encontrada' };

  const description = vacante.descripcion
    .replace(/<[^>]*>/g, '')
    .substring(0, 160);
  const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || '';

  return {
    title: `${vacante.titulo} en ${vacante.empresa_nombre} | Empleo`,
    description,
    openGraph: {
      title: `${vacante.titulo} - ${vacante.empresa_nombre}`,
      description,
      type: 'website',
      url: `${baseUrl}/empleo/${slug}`,
      siteName: 'Hirely',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${vacante.titulo} - ${vacante.empresa_nombre}`,
      description,
    },
  };
}

async function getVacantePublicaForMeta(slug: string) {
  const { pool } = await import('@/lib/db');
  const result = await pool.query(
    `SELECT v.titulo, v.descripcion, o.name as empresa_nombre
     FROM vacantes v
     JOIN organizations o ON o.id = v.organization_id
     WHERE v.slug = $1 AND v.is_published = true AND v.estado = 'publicada'`,
    [slug]
  );
  return result.rows[0] || null;
}

export default async function PublicVacanteSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vacante = await getVacantePublica(slug);
  if (!vacante) notFound();

  const habilidades = Array.isArray(vacante.habilidades_requeridas)
    ? vacante.habilidades_requeridas.map((h: string | { name: string }) =>
        typeof h === 'string' ? h : h.name)
    : [];

  const modalidadLabels: Record<string, string> = {
    remoto: 'Remoto', hibrido: 'Hibrido', presencial: 'Presencial',
  };
  const contratoLabels: Record<string, string> = {
    indefinido: 'Indefinido', termino_fijo: 'Termino fijo',
    prestacion_servicios: 'Prestacion de servicios', obra_labor: 'Obra o labor',
    aprendizaje: 'Aprendizaje', laboral: 'Tiempo completo',
    horas_demanda: 'Medio tiempo', por_servicios: 'Por servicios',
  };

  return (
    <div className="space-y-6">
      {/* Hero Header with gradient */}
      <div className="relative overflow-hidden bg-white rounded-xl shadow-sm border">
        <div className="absolute inset-0 bg-gradient-to-br from-navy/5 via-teal/5 to-transparent" />
        <div className="relative p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            {vacante.empresa_logo ? (
              <img src={vacante.empresa_logo} alt={vacante.empresa_nombre} className="h-12 w-12 rounded-xl object-cover shadow-sm" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-teal/10 flex items-center justify-center shadow-sm">
                <Building className="h-6 w-6 text-teal" />
              </div>
            )}
            <div>
              <p className="font-semibold text-navy">{vacante.empresa_nombre}</p>
              {vacante.empresa_website && (
                <a href={vacante.empresa_website} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-teal transition-colors">
                  {vacante.empresa_website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-navy mb-4">{vacante.titulo}</h1>

          <div className="flex flex-wrap gap-2">
            {vacante.modalidad && (
              <Badge variant="secondary" className="bg-teal/10 text-teal gap-1.5 px-3 py-1">
                <Home className="h-3.5 w-3.5" />
                {modalidadLabels[vacante.modalidad] || vacante.modalidad}
              </Badge>
            )}
            {vacante.ubicacion && (
              <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                <MapPin className="h-3.5 w-3.5" />
                {vacante.ubicacion}
              </Badge>
            )}
            {vacante.tipo_contrato && (
              <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                <Briefcase className="h-3.5 w-3.5" />
                {contratoLabels[vacante.tipo_contrato] || vacante.tipo_contrato}
              </Badge>
            )}
            {vacante.rango_salarial_min && vacante.rango_salarial_max && (
              <Badge variant="secondary" className="gap-1.5 px-3 py-1 bg-green-50 text-green-700">
                <DollarSign className="h-3.5 w-3.5" />
                {vacante.moneda} {new Intl.NumberFormat('es-CO').format(vacante.rango_salarial_min)} - {new Intl.NumberFormat('es-CO').format(vacante.rango_salarial_max)}
              </Badge>
            )}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:block mt-5">
            <a
              href="#postularme"
              className="inline-flex items-center gap-2 bg-teal hover:bg-teal/90 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
            >
              Postularme ahora
            </a>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8">
        <h2 className="text-lg font-semibold text-navy mb-3 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-teal" /> Sobre la posicion
        </h2>
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {vacante.descripcion}
        </div>
      </div>

      {/* Requirements */}
      {(habilidades.length > 0 || (vacante.experiencia_minima && vacante.experiencia_minima > 0) || vacante.nivel_estudios) && (
        <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8">
          <h2 className="text-lg font-semibold text-navy mb-4 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-teal" /> Requisitos
          </h2>

          <div className="space-y-4">
            {vacante.experiencia_minima > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{vacante.experiencia_minima}+ {vacante.experiencia_minima === 1 ? 'ano' : 'anos'} de experiencia</span>
              </div>
            )}
            {vacante.nivel_estudios && (
              <div className="flex items-center gap-2 text-sm">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <span>{vacante.nivel_estudios}</span>
              </div>
            )}
            {habilidades.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Habilidades requeridas</p>
                <div className="flex flex-wrap gap-2">
                  {habilidades.map((h: string) => (
                    <span key={h} className="bg-teal/10 text-teal px-3 py-1 rounded-full text-sm font-medium">{h}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Application Form */}
      <div id="postularme" className="bg-white rounded-xl shadow-sm border p-6 md:p-8">
        <h2 className="text-lg font-semibold text-navy mb-4">Postularme a esta vacante</h2>
        <AplicacionFormWrapper
          slug={slug}
          vacanteTitulo={vacante.titulo}
          empresaNombre={vacante.empresa_nombre}
          habilidadesSugeridas={habilidades}
        />
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t shadow-lg p-3 md:hidden z-50">
        <a href="#postularme" className="block w-full bg-teal hover:bg-teal/90 text-white font-semibold py-3 rounded-lg text-center transition-colors">
          Postularme ahora
        </a>
      </div>
    </div>
  );
}
