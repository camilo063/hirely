'use client';

import { useReveal } from '@/hooks/useReveal';
import {
  ShieldCheck,
  Briefcase,
  FileSearch,
  Mic,
  CalendarDays,
  ClipboardCheck,
  FolderOpen,
  Mail,
  PenTool,
  BarChart3,
} from 'lucide-react';

interface Module {
  number: string;
  name: string;
  description: string;
  icon: React.ElementType;
  tech: string;
}

const modules: Module[] = [
  {
    number: 'M\u00B701',
    name: 'Auth + Dashboard',
    description: 'Login, registro, roles y metricas centralizadas',
    icon: ShieldCheck,
    tech: 'NextAuth v5',
  },
  {
    number: 'M\u00B702',
    name: 'Vacantes',
    description: 'CRUD, maquina de estados y portal publico',
    icon: Briefcase,
    tech: 'Estado Machine',
  },
  {
    number: 'M\u00B703',
    name: 'Candidatos + CV Parsing',
    description: 'Parsing inteligente y scoring ATS automatico',
    icon: FileSearch,
    tech: 'Claude AI',
  },
  {
    number: 'M\u00B704',
    name: 'Entrevistas IA',
    description: 'Entrevistas por voz con analisis automatizado',
    icon: Mic,
    tech: 'Dapta + Claude',
  },
  {
    number: 'M\u00B705',
    name: 'Entrevistas Humanas',
    description: 'Agendamiento y evaluacion con Google Meet',
    icon: CalendarDays,
    tech: 'Google Calendar',
  },
  {
    number: 'M\u00B706',
    name: 'Evaluaciones Tecnicas',
    description: 'Banco de preguntas y evaluaciones multi-tipo',
    icon: ClipboardCheck,
    tech: 'Multi-tipo',
  },
  {
    number: 'M\u00B707',
    name: 'Seleccion + Documentos',
    description: 'Portal seguro para carga de documentacion',
    icon: FolderOpen,
    tech: 'Token 30 dias',
  },
  {
    number: 'M\u00B708',
    name: 'Onboarding',
    description: 'Flujo de bienvenida y comunicacion automatica',
    icon: Mail,
    tech: 'Resend',
  },
  {
    number: 'M\u00B709',
    name: 'Contratos + Firma Digital',
    description: '3 tipos colombianos con firma electronica',
    icon: PenTool,
    tech: 'SignWell',
  },
  {
    number: 'M\u00B710',
    name: 'Reportes y Analytics',
    description: 'Dashboard, metricas y reportes en tiempo real',
    icon: BarChart3,
    tech: 'PostgreSQL Views',
  },
];

function ModuleCard({ mod, index }: { mod: Module; index: number }) {
  const { ref, isVisible } = useReveal(0.05);
  const Icon = mod.icon;

  return (
    <div
      ref={ref}
      className={`group flex flex-col rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition-all duration-500 hover:border-teal/40 hover:shadow-lg ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
      style={{ transitionDelay: `${(index % 5) * 80}ms` }}
    >
      <div className="mb-4 flex items-start justify-between">
        <span className="font-mono text-xs font-bold tracking-wider text-teal">{mod.number}</span>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/5 text-navy transition-colors group-hover:bg-teal/10 group-hover:text-teal">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <h3 className="mb-1 text-sm font-bold text-navy">{mod.name}</h3>
      <p className="mb-4 flex-1 text-xs leading-relaxed text-gray-500">{mod.description}</p>
      <span className="inline-flex w-fit items-center rounded-full bg-teal/5 px-2.5 py-1 font-mono text-[10px] font-medium text-teal">
        {mod.tech}
      </span>
    </div>
  );
}

export default function ModulesSection() {
  const { ref, isVisible } = useReveal(0.1);

  return (
    <section className="bg-[#F8FAFC] py-20">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div ref={ref} className="mb-14 text-center">
          <span
            className={`inline-block font-mono text-xs font-semibold uppercase tracking-widest text-teal transition-all duration-700 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            Cobertura funcional completa
          </span>
          <h2
            className={`mt-4 text-3xl font-bold text-navy transition-all duration-700 delay-100 sm:text-4xl ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
            }`}
          >
            10 modulos. Un solo sistema.
          </h2>
        </div>

        {/* Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {modules.map((mod, i) => (
            <ModuleCard key={mod.number} mod={mod} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
