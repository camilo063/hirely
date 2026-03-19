'use client';

import { useReveal } from '@/hooks/useReveal';
import {
  Settings,
  Briefcase,
  Globe,
  Users,
  Brain,
  UserCheck,
  FileCheck,
  BarChart3,
} from 'lucide-react';

interface Phase {
  number: string;
  title: string;
  icon: React.ElementType;
  accent: string;
  accentBg: string;
  accentBorder: string;
  badge?: string;
  bullets: string[];
}

const phases: Phase[] = [
  {
    number: '01',
    title: 'Preparacion',
    icon: Settings,
    accent: 'text-teal',
    accentBg: 'bg-teal/10',
    accentBorder: 'border-teal/30',
    bullets: [
      'Configura tu organizacion, equipo y roles',
      'Define criterios de evaluacion y pesos de scoring',
      'Prepara plantillas de contrato y banco de preguntas',
    ],
  },
  {
    number: '02',
    title: 'Publicar Vacante',
    icon: Globe,
    accent: 'text-teal',
    accentBg: 'bg-teal/10',
    accentBorder: 'border-teal/30',
    badge: '/empleo/[slug]',
    bullets: [
      'Crea vacantes con descripcion, requisitos y salario',
      'Publica en portal publico con URL amigable',
      'Comparte en LinkedIn con un clic',
    ],
  },
  {
    number: '03',
    title: 'Recibir Candidatos',
    icon: Users,
    accent: 'text-orange',
    accentBg: 'bg-orange/10',
    accentBorder: 'border-orange/30',
    badge: 'Claude AI',
    bullets: [
      'Parsing automatico de CV con Claude AI',
      'Scoring ATS en 6 dimensiones objetivas',
      'Ranking automatico de candidatos por relevancia',
    ],
  },
  {
    number: '04',
    title: 'Evaluar Candidatos',
    icon: Brain,
    accent: 'text-[#7C3AED]',
    accentBg: 'bg-[#7C3AED]/10',
    accentBorder: 'border-[#7C3AED]/30',
    bullets: [
      'Entrevistas IA con voz via Dapta + analisis Claude',
      'Entrevistas humanas con Google Calendar + Meet',
      'Evaluaciones tecnicas multi-tipo con token publico',
    ],
  },
  {
    number: '05',
    title: 'Seleccionar',
    icon: UserCheck,
    accent: 'text-orange',
    accentBg: 'bg-orange/10',
    accentBorder: 'border-orange/30',
    badge: '/portal/documentos/[token]',
    bullets: [
      'Score final ponderado de 4 fuentes automaticas',
      'Portal de documentos con token seguro (30 dias)',
      'Checklist configurable de documentacion requerida',
    ],
  },
  {
    number: '06',
    title: 'Contratar',
    icon: FileCheck,
    accent: 'text-[#10B981]',
    accentBg: 'bg-[#10B981]/10',
    accentBorder: 'border-[#10B981]/30',
    badge: 'SignWell',
    bullets: [
      '3 tipos de contrato colombianos con variables dinamicas',
      'Firma digital integrada con SignWell',
      'Versionamiento y trazabilidad completa',
    ],
  },
  {
    number: '07',
    title: 'Analizar',
    icon: BarChart3,
    accent: 'text-slate-400',
    accentBg: 'bg-slate-400/10',
    accentBorder: 'border-slate-400/30',
    bullets: [
      'Dashboard con metricas clave en tiempo real',
      'Reportes de pipeline, tiempo de contratacion y fuentes',
      'PostgreSQL views optimizadas para analytics',
    ],
  },
];

function PhaseCard({ phase, index }: { phase: Phase; index: number }) {
  const { ref, isVisible } = useReveal(0.1);
  const Icon = phase.icon;

  return (
    <div ref={ref} className="relative flex gap-6">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div
          className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${phase.accentBorder} ${phase.accentBg} transition-all duration-700 ${
            isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
          }`}
        >
          <Icon className={`h-5 w-5 ${phase.accent}`} />
        </div>
        {index < phases.length - 1 && (
          <div className="w-px flex-1 border-l-2 border-dashed border-white/10" />
        )}
      </div>

      {/* Content */}
      <div
        className={`mb-12 flex-1 rounded-xl border border-white/5 bg-white/[0.03] p-6 transition-all duration-700 ${
          isVisible ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0'
        }`}
        style={{ transitionDelay: '100ms' }}
      >
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span
            className={`inline-block rounded border ${phase.accentBorder} ${phase.accentBg} px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${phase.accent}`}
          >
            Fase {phase.number}
          </span>
          {phase.badge && (
            <span className="inline-block rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/40">
              {phase.badge}
            </span>
          )}
        </div>
        <h3 className="mb-3 text-lg font-bold text-white">{phase.title}</h3>
        <ul className="space-y-2">
          {phase.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-sm text-white/55">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${phase.accentBg}`} />
              {bullet}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function HowItWorksSection() {
  const { ref, isVisible } = useReveal(0.1);

  return (
    <section className="bg-[#0A1F3F] py-20">
      <div className="mx-auto max-w-4xl px-6">
        {/* Header */}
        <div ref={ref} className="mb-16 text-center">
          <span
            className={`inline-block font-mono text-xs font-semibold uppercase tracking-widest text-teal transition-all duration-700 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            De la vacante al contrato en un solo flujo
          </span>
          <h2
            className={`mt-4 text-3xl font-bold text-white transition-all duration-700 delay-100 sm:text-4xl ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
            }`}
          >
            7 fases. Automatizado de extremo a extremo.
          </h2>
          <p
            className={`mt-4 text-white/55 transition-all duration-700 delay-200 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            Cada fase se conecta con la siguiente. Sin gaps, sin trabajo manual repetitivo, sin
            perder informacion entre pasos.
          </p>
        </div>

        {/* Timeline */}
        <div>
          {phases.map((phase, i) => (
            <PhaseCard key={phase.number} phase={phase} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
