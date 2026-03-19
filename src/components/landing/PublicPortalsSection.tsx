'use client';

import { useReveal } from '@/hooks/useReveal';
import { CheckCircle2 } from 'lucide-react';

interface Portal {
  name: string;
  url: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  description: string;
  features: string[];
}

const portals: Portal[] = [
  {
    name: 'Portal de Vacante',
    url: '/empleo/[slug]',
    accent: 'text-teal',
    accentBg: 'from-teal/20 to-teal/5',
    accentBorder: 'border-teal/30',
    description:
      'Pagina publica optimizada para SEO donde los candidatos aplican directamente con su CV.',
    features: [
      'Descripcion completa de la vacante',
      'Formulario de aplicacion integrado',
      'Upload de CV con parsing Claude AI',
      'Scoring ATS automatico al aplicar',
      'SEO optimizado para Google',
    ],
  },
  {
    name: 'Portal de Evaluacion',
    url: '/evaluacion/[token\u00B772h]',
    accent: 'text-[#7C3AED]',
    accentBg: 'from-[#7C3AED]/20 to-[#7C3AED]/5',
    accentBorder: 'border-[#7C3AED]/30',
    description:
      'Evaluaciones tecnicas con token temporal, timer configurable y envio automatico.',
    features: [
      'Token con expiracion de 72 horas',
      'Timer configurable por evaluacion',
      'Preguntas multi-tipo (opcion multiple, codigo, abierta)',
      'Auto-submit al expirar el tiempo',
      'Resultados inmediatos al equipo',
    ],
  },
  {
    name: 'Portal de Documentos',
    url: '/portal/documentos/[token\u00B730d]',
    accent: 'text-green-400',
    accentBg: 'from-green-500/20 to-green-500/5',
    accentBorder: 'border-green-500/30',
    description:
      'Portal seguro para que el candidato suba su documentacion requerida sin crear cuenta.',
    features: [
      'Token valido por 30 dias',
      'Drag & drop de documentos',
      'Estado en tiempo real por documento',
      'Verificacion del equipo de RRHH',
      'Notificacion automatica al completar',
    ],
  },
];

function PortalCard({ portal, index }: { portal: Portal; index: number }) {
  const { ref, isVisible } = useReveal(0.05);

  return (
    <div
      ref={ref}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border ${portal.accentBorder} bg-white/5 backdrop-blur-sm transition-all duration-500 hover:bg-white/10 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${portal.accentBg}`}
      />

      <div className="flex flex-1 flex-col p-6 sm:p-8">
        <span
          className={`mb-4 inline-block w-fit rounded-md border ${portal.accentBorder} bg-white/5 px-3 py-1.5 font-mono text-[11px] tracking-wide ${portal.accent}`}
        >
          {portal.url}
        </span>

        <h3 className="mb-2 text-xl font-bold text-white">{portal.name}</h3>
        <p className="mb-6 text-sm leading-relaxed text-white/60">{portal.description}</p>

        <ul className="mt-auto space-y-3">
          {portal.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5">
              <CheckCircle2
                className={`mt-0.5 h-4 w-4 flex-shrink-0 ${portal.accent}`}
              />
              <span className="text-sm text-white/80">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function PublicPortalsSection() {
  const { ref, isVisible } = useReveal(0.1);

  return (
    <section className="bg-[#0A1F3F] py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div ref={ref} className="mb-14 text-center">
          <span
            className={`inline-block font-mono text-xs font-semibold uppercase tracking-widest text-teal transition-all duration-700 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            Sin friccion para el candidato
          </span>
          <h2
            className={`mt-4 text-3xl font-bold text-white transition-all duration-700 delay-100 sm:text-4xl ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
            }`}
          >
            3 portales publicos. Sin login requerido.
          </h2>
          <p
            className={`mx-auto mt-4 max-w-2xl text-base text-white/60 transition-all duration-700 delay-200 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
            }`}
          >
            Los candidatos acceden con un enlace unico. Sin cuentas, sin passwords, sin friccion.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {portals.map((portal, i) => (
            <PortalCard key={portal.name} portal={portal} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export { PublicPortalsSection };
