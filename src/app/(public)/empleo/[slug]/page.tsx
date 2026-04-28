import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MapPin, Briefcase, Clock, Building, Home, ShieldCheck, Users, GraduationCap } from 'lucide-react';
import { getVacantePublica } from '@/lib/services/portal-vacantes.service';
import { AplicacionFormWrapper } from '@/components/portal/aplicacion-form-wrapper';

// SEO metadata
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const vacante = await getVacantePublicaForMeta(slug);
  const baseUrl = (process.env.NEXTAUTH_URL || process.env.APP_URL || '').replace(/\/+$/, '');

  if (!vacante) {
    return {
      title: 'Vacante no encontrada',
      openGraph: baseUrl ? { images: [`${baseUrl}/api/og/fallback`] } : undefined,
    };
  }

  const description = vacante.descripcion
    .replace(/<[^>]*>/g, '')
    .substring(0, 160);
  const ogImageUrl = baseUrl ? `${baseUrl}/api/og/vacante/${vacante.id}` : `/api/og/vacante/${vacante.id}`;

  return {
    title: `${vacante.titulo} en ${vacante.empresa_nombre} | Empleo`,
    description,
    openGraph: {
      title: `${vacante.titulo} - ${vacante.empresa_nombre}`,
      description,
      type: 'website',
      url: baseUrl ? `${baseUrl}/empleo/${slug}` : `/empleo/${slug}`,
      siteName: 'Hirely',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${vacante.titulo} en ${vacante.empresa_nombre}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${vacante.titulo} - ${vacante.empresa_nombre}`,
      description,
      images: [ogImageUrl],
    },
  };
}

async function getVacantePublicaForMeta(slug: string) {
  const { pool } = await import('@/lib/db');
  const result = await pool.query(
    `SELECT v.id, v.titulo, v.descripcion, o.name as empresa_nombre
     FROM vacantes v
     JOIN organizations o ON o.id = v.organization_id
     WHERE v.slug = $1 AND v.is_published = true AND v.estado = 'publicada'`,
    [slug]
  );
  return result.rows[0] || null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const modalidadLabels: Record<string, string> = {
  remoto: 'Remoto', hibrido: 'Hibrido', presencial: 'Presencial',
};
const contratoLabels: Record<string, string> = {
  indefinido: 'Indefinido', termino_fijo: 'Termino fijo',
  prestacion_servicios: 'Prestacion de servicios', obra_labor: 'Obra o labor',
  aprendizaje: 'Aprendizaje', laboral: 'Tiempo completo',
  horas_demanda: 'Medio tiempo', por_servicios: 'Por servicios',
};

function formatSalario(value: number | null, moneda: string = 'COP'): string {
  if (!value) return '';
  return `${moneda} ${new Intl.NumberFormat('es-CO').format(value)}`;
}

function calcDiasPublicada(publishedAt: string): string {
  const dias = Math.floor(
    (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'hace 1 dia';
  return `hace ${dias} dias`;
}

type SkillCategory = 'IA & Automatizacion' | 'Cloud & Arquitectura' | 'Liderazgo & Negocio' | 'Desarrollo' | 'Otras';

const skillCategoryColors: Record<SkillCategory, string> = {
  'IA & Automatizacion': 'bg-teal-50 text-teal-800 border border-teal-200',
  'Cloud & Arquitectura': 'bg-blue-50 text-blue-800 border border-blue-200',
  'Liderazgo & Negocio': 'bg-orange-50 text-orange-800 border border-orange-200',
  'Desarrollo': 'bg-purple-50 text-purple-800 border border-purple-200',
  'Otras': 'bg-gray-50 text-gray-700 border border-gray-200',
};

const skillKeywords: Record<string, string[]> = {
  'IA & Automatizacion': [
    'ia', 'inteligencia artificial', 'n8n', 'llm', 'automatizacion', 'automatización',
    'machine learning', 'ml', 'ai', 'gpt', 'chatbot', 'agentes', 'datos', 'analytics',
    'transformacion digital', 'transformación digital', 'transformacion', 'transformación',
    'digital', 'rpa', 'proceso', 'procesos',
  ],
  'Cloud & Arquitectura': [
    'cloud', 'aws', 'gcp', 'azure', 'arquitectura', 'infraestructura',
    'devops', 'kubernetes', 'docker', 'microservicios', 'serverless',
    'terraform', 'ci/cd', 'sre',
  ],
  'Liderazgo & Negocio': [
    'liderazgo', 'estrategia', 'b2b', 'management', 'staff augmentation',
    'gestion', 'gestión', 'negocio', 'comercial', 'ventas', 'growth',
    'producto', 'emprendimiento', 'startup',
  ],
  'Desarrollo': [
    'desarrollo', 'software', 'react', 'next', 'python', 'typescript',
    'javascript', 'node', 'java', 'angular', 'vue', 'go', 'rust', 'php',
    'laravel', 'django', 'api', 'rest', 'graphql', 'mobile', 'ios',
    'android', 'backend', 'frontend', 'fullstack',
  ],
};

function normalizarTexto(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function categorizarSkills(skills: string[]): [SkillCategory, string[]][] {
  const categorias: Record<SkillCategory, string[]> = {
    'IA & Automatizacion': [],
    'Cloud & Arquitectura': [],
    'Liderazgo & Negocio': [],
    'Desarrollo': [],
    'Otras': [],
  };

  skills.forEach(skill => {
    const skillNorm = normalizarTexto(skill);
    let asignada = false;
    for (const [cat, kws] of Object.entries(skillKeywords)) {
      if (kws.some(kw => skillNorm.includes(normalizarTexto(kw)))) {
        categorias[cat as SkillCategory].push(skill);
        asignada = true;
        break;
      }
    }
    if (!asignada) categorias['Otras'].push(skill);
  });

  return (Object.entries(categorias) as [SkillCategory, string[]][]).filter(([, s]) => s.length > 0);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function VacanteSection({ icon, title, iconBg, children }: {
  icon: React.ReactNode;
  title: string;
  iconBg: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MetaRow({ icon, text }: { icon: React.ReactNode; text: string | null }) {
  if (!text) return null;
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-sm text-gray-600">
      <span className="text-gray-400">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function CounterItem({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
    </div>
  );
}

// ─── Description parser ──────────────────────────────────────────────────────

interface BloqueDescripcion {
  tipo: 'parrafo' | 'lista';
  titulo?: string;
  contenido: string[];
}

const tituloPattern = /^(Responsabilidades|Requisitos|Sobre|Funciones|Beneficios|Ofrecemos|Perfil|Acerca|About|Requirements|Responsibilities|Descripcion|Lo que buscamos|Lo que ofrecemos|Que haras|Que necesitas):?$/i;

function parsearDescripcion(texto: string): BloqueDescripcion[] {
  if (!texto) return [];

  const bloques: BloqueDescripcion[] = [];
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);

  let bloqueActual: BloqueDescripcion | null = null;

  for (const linea of lineas) {
    const esItem = linea.startsWith('-') || linea.startsWith('\u2022') ||
                   linea.startsWith('*') || /^\d+\./.test(linea);
    const esTitulo = tituloPattern.test(linea);

    if (esTitulo) {
      if (bloqueActual) bloques.push(bloqueActual);
      bloqueActual = { tipo: 'lista', titulo: linea.replace(/:$/, ''), contenido: [] };
    } else if (esItem) {
      if (!bloqueActual || bloqueActual.tipo === 'parrafo') {
        if (bloqueActual) bloques.push(bloqueActual);
        bloqueActual = { tipo: 'lista', contenido: [] };
      }
      const textoItem = linea.replace(/^[-\u2022*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
      if (textoItem) bloqueActual.contenido.push(textoItem);
    } else {
      if (!bloqueActual || bloqueActual.tipo === 'lista') {
        if (bloqueActual) bloques.push(bloqueActual);
        bloqueActual = { tipo: 'parrafo', contenido: [linea] };
      } else {
        bloqueActual.contenido[0] = (bloqueActual.contenido[0] || '') + ' ' + linea;
      }
    }
  }

  if (bloqueActual) bloques.push(bloqueActual);
  return bloques.filter(b => b.contenido.some(c => c.trim()));
}

// ─── Page ────────────────────────────────────────────────────────────────────

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

  const textoFecha = calcDiasPublicada(vacante.published_at);
  const candidatosCount = vacante.candidatos_count || 0;
  const diasPublicada = Math.floor(
    (Date.now() - new Date(vacante.published_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const skillGroups = categorizarSkills(habilidades);
  const bloques = parsearDescripcion(vacante.descripcion);

  return (
    <div className="space-y-0">
      {/* ─── Hero Section ─── */}
      <div className="relative overflow-hidden bg-[#0A1F3F] rounded-xl">
        {/* Decorative circle */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#00BCD4] opacity-[0.04]" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#00BCD4] opacity-[0.03]" />

        <div className="relative p-5 md:p-8">
          {/* Company logo — natural aspect ratio, no white frame */}
          <div className="flex items-center mb-4">
            {vacante.empresa_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vacante.empresa_logo} alt={vacante.empresa_nombre} className="h-12 w-auto max-w-[260px] object-contain" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center ring-1 ring-white/10">
                <Building className="h-6 w-6 text-white/70" />
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-4">{vacante.titulo}</h1>

          {/* Pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {vacante.modalidad && (
              <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white/80 text-xs px-2.5 py-1 rounded-full">
                <Home className="h-3 w-3" />
                {modalidadLabels[vacante.modalidad] || vacante.modalidad}
              </span>
            )}
            {vacante.ubicacion && (
              <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white/80 text-xs px-2.5 py-1 rounded-full">
                <MapPin className="h-3 w-3" />
                {vacante.ubicacion}
              </span>
            )}
            {vacante.tipo_contrato && (
              <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white/80 text-xs px-2.5 py-1 rounded-full">
                <Briefcase className="h-3 w-3" />
                {contratoLabels[vacante.tipo_contrato] || vacante.tipo_contrato}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 bg-emerald-400/15 border border-emerald-400/25 text-emerald-300 text-xs px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Activa
            </span>
          </div>

          {/* Salary */}
          {vacante.rango_salarial_min && vacante.rango_salarial_max && (
            <p className="text-[#00BCD4] text-lg md:text-xl font-semibold mb-1">
              {formatSalario(vacante.rango_salarial_min, vacante.moneda)} &ndash; {formatSalario(vacante.rango_salarial_max, vacante.moneda)}
            </p>
          )}

          {/* Social proof */}
          <p className="text-white/40 text-sm mb-5">
            {candidatosCount > 0 && <>{candidatosCount} {candidatosCount === 1 ? 'candidato postulado' : 'candidatos postulados'} &middot; </>}
            Publicada {textoFecha}
          </p>

          {/* CTA */}
          <a
            href="#postularme"
            className="inline-flex items-center gap-2 bg-[#FF6B35] hover:bg-[#e55a2b] text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
          >
            Postularme ahora &rarr;
          </a>
        </div>
      </div>

      {/* ─── Two-column layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-0 pt-4">
        {/* ─── Main column ─── */}
        <div className="pr-0 lg:pr-5 space-y-0">
          {/* Description — parsed into semantic blocks */}
          <VacanteSection
            icon={<Briefcase className="h-3.5 w-3.5 text-[#0A1F3F]" />}
            title="Sobre la posicion"
            iconBg="bg-[#0A1F3F]/[0.08]"
          >
            <div className="space-y-4">
              {bloques.map((bloque, i) => (
                <div key={i}>
                  {bloque.titulo && (
                    <h4 className="text-sm font-semibold text-gray-800 mb-2 mt-1">
                      {bloque.titulo}
                    </h4>
                  )}
                  {bloque.tipo === 'parrafo' ? (
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {bloque.contenido[0]}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {bloque.contenido.map((item, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-sm text-gray-600">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#00BCD4] flex-shrink-0" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </VacanteSection>

          {/* Requirements */}
          {(habilidades.length > 0 || (vacante.experiencia_minima && vacante.experiencia_minima > 0) || vacante.nivel_estudios) && (
            <VacanteSection
              icon={<ShieldCheck className="h-3.5 w-3.5 text-[#FF6B35]" />}
              title="Requisitos"
              iconBg="bg-[#FF6B35]/[0.08]"
            >
              <div className="space-y-3">
                {/* Experience badge */}
                {vacante.experiencia_minima > 0 && (
                  <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    <span>{vacante.experiencia_minima}+ {vacante.experiencia_minima === 1 ? 'ano' : 'anos'} de experiencia</span>
                  </div>
                )}
                {vacante.nivel_estudios && (
                  <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 ml-2">
                    <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
                    <span>{vacante.nivel_estudios}</span>
                  </div>
                )}

                {/* Skills grouped by category */}
                {skillGroups.length > 0 && (
                  <div className="space-y-3 pt-1">
                    {skillGroups.map(([category, skills]) => (
                      <div key={category}>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">{category}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {skills.map(skill => (
                            <span
                              key={skill}
                              className={`text-xs px-2.5 py-1 rounded-full font-medium ${skillCategoryColors[category]}`}
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </VacanteSection>
          )}

          {/* Application Form */}
          <div id="postularme" className="bg-white border border-gray-100 rounded-xl p-4 mb-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#10B981]/[0.08]">
                <Users className="h-3.5 w-3.5 text-[#10B981]" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Postularme a esta vacante</h3>
            </div>
            <AplicacionFormWrapper
              slug={slug}
              vacanteTitulo={vacante.titulo}
              empresaNombre={vacante.empresa_nombre}
              habilidadesSugeridas={habilidades}
            />
          </div>
        </div>

        {/* ─── Sidebar ─── */}
        <div className="hidden lg:block">
          <div className="lg:sticky lg:top-6 space-y-3">
            {/* Summary card */}
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-900 mb-3">Resumen</p>

              <MetaRow icon={<Briefcase className="h-3.5 w-3.5" />} text={contratoLabels[vacante.tipo_contrato] || vacante.tipo_contrato} />
              <MetaRow icon={<MapPin className="h-3.5 w-3.5" />} text={`${vacante.ubicacion}${vacante.modalidad ? ` \u00B7 ${modalidadLabels[vacante.modalidad] || vacante.modalidad}` : ''}`} />
              {vacante.nivel_estudios && <MetaRow icon={<GraduationCap className="h-3.5 w-3.5" />} text={vacante.nivel_estudios} />}
              {vacante.departamento && (
                <div className="flex items-center gap-2.5 py-1.5 text-sm text-gray-600">
                  <span className="text-gray-400">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                      <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.6"/>
                      <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.6"/>
                      <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.4"/>
                      <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.4"/>
                    </svg>
                  </span>
                  <span><span className="text-gray-400 text-xs mr-1">Area:</span>{vacante.departamento}</span>
                </div>
              )}

              {/* Counters */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-50">
                <CounterItem value={candidatosCount} label="postulados" />
                <CounterItem value={`${diasPublicada}d`} label="publicada" />
                <CounterItem
                  value={vacante.rango_salarial_max ? `${(vacante.rango_salarial_max / 1_000_000).toFixed(1)}M` : '-'}
                  label="salario max."
                />
              </div>
            </div>

            {/* CTA buttons */}
            <a
              href="#postularme"
              className="block w-full bg-[#FF6B35] hover:bg-[#e55a2b] text-white font-semibold py-3 rounded-lg text-sm text-center transition-colors"
            >
              Postularme ahora &rarr;
            </a>
            {/* Company info */}
            {vacante.empresa_descripcion && (
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-900 mb-2">Sobre {vacante.empresa_nombre}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{vacante.empresa_descripcion}</p>
                {vacante.empresa_website && (
                  <a
                    href={vacante.empresa_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#00BCD4] hover:underline mt-2 inline-block"
                  >
                    Visitar sitio web &rarr;
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Sticky mobile CTA ─── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t shadow-lg p-3 md:hidden z-50">
        <a href="#postularme" className="block w-full bg-[#FF6B35] hover:bg-[#e55a2b] text-white font-semibold py-3 rounded-lg text-center transition-colors text-sm">
          Postularme ahora &rarr;
        </a>
      </div>
    </div>
  );
}
