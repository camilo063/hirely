'use client';

import { useReveal } from '@/hooks/useReveal';
import {
  Brain,
  Phone,
  Mail,
  FileSignature,
  Calendar,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface Feature {
  name: string;
  description: string;
  icon: React.ElementType;
  highlights: string[];
  color: string;
  colorBg: string;
}

const features: Feature[] = [
  {
    name: 'Parsing inteligente de CVs',
    description: 'Sube un CV en PDF y el sistema extrae automaticamente experiencia, educacion, habilidades, idiomas y certificaciones. Sin captura manual.',
    icon: Brain,
    highlights: ['Extraccion automatica de datos', 'Scoring ATS con 6 dimensiones', 'Soporte PDF nativo'],
    color: 'text-teal',
    colorBg: 'bg-teal/10',
  },
  {
    name: 'Entrevistas de voz automatizadas',
    description: 'El candidato recibe una llamada telefonica real con un agente de voz inteligente que conduce la entrevista, graba y genera un analisis de competencias.',
    icon: Phone,
    highlights: ['Llamadas reales al candidato', 'Transcripcion y analisis automatico', '5 competencias evaluadas'],
    color: 'text-orange',
    colorBg: 'bg-orange/10',
  },
  {
    name: 'Emails automaticos personalizados',
    description: 'Invitaciones a entrevistas, envio de evaluaciones, bienvenida de onboarding y mas. Cada email usa plantillas HTML con variables dinamicas.',
    icon: Mail,
    highlights: ['5 tipos de email automatico', 'Plantillas HTML personalizables', 'Envio inmediato o programado'],
    color: 'text-[#7C3AED]',
    colorBg: 'bg-[#7C3AED]/10',
  },
  {
    name: 'Firma electronica de contratos',
    description: 'Genera contratos desde plantillas, auto-pobla los datos del candidato y envialos a firma digital. El candidato firma desde su celular o computador.',
    icon: FileSignature,
    highlights: ['Auto-poblado de datos', 'Firma desde cualquier dispositivo', 'Tracking de estado en tiempo real'],
    color: 'text-success',
    colorBg: 'bg-success/10',
  },
  {
    name: 'Agendamiento con calendario',
    description: 'Agenda entrevistas humanas y se crean automaticamente eventos en el calendario del entrevistador con enlace de videollamada incluido.',
    icon: Calendar,
    highlights: ['Creacion automatica de eventos', 'Link de videollamada incluido', 'Sincronizacion bidireccional'],
    color: 'text-teal',
    colorBg: 'bg-teal/10',
  },
  {
    name: 'Publicacion multicanal',
    description: 'Publica vacantes en tu portal publico con URL dedicada y SEO optimizado. Los candidatos aplican directamente sin crear cuenta.',
    icon: Share2,
    highlights: ['Portal publico con URL unica', 'SEO optimizado', 'Formulario de aplicacion integrado'],
    color: 'text-orange',
    colorBg: 'bg-orange/10',
  },
  {
    name: 'Seguridad anti-trampa',
    description: 'Las evaluaciones tecnicas incluyen deteccion de cambio de pestana, bloqueo de copia y registro de actividad sospechosa. Todo queda registrado.',
    icon: ShieldCheck,
    highlights: ['Deteccion de cambio de pestana', 'Bloqueo de copy/paste', 'Reporte de integridad para el reclutador'],
    color: 'text-red-500',
    colorBg: 'bg-red-50',
  },
  {
    name: 'Generacion de preguntas con IA',
    description: 'Genera preguntas de evaluacion tecnica de cualquier area o industria con un clic. Revisa, edita y guarda al banco las que te sirvan.',
    icon: Sparkles,
    highlights: ['Cualquier categoria o industria', 'Opcion multiple, V/F, abierta, codigo', 'Revision y edicion antes de guardar'],
    color: 'text-[#7C3AED]',
    colorBg: 'bg-[#7C3AED]/10',
  },
];

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const { ref, isVisible } = useReveal(0.05);

  return (
    <div
      ref={ref}
      className={`group flex flex-col rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition-all duration-500 hover:border-teal/40 hover:shadow-lg hover:shadow-teal/5 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
      style={{ transitionDelay: `${(index % 4) * 80}ms` }}
    >
      <div className="mb-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.colorBg} ${feature.color} transition-transform group-hover:scale-110`}>
          <feature.icon className="h-5 w-5" />
        </div>
      </div>

      <h3 className="mb-2 text-sm font-bold text-navy">{feature.name}</h3>
      <p className="mb-4 flex-1 text-xs leading-relaxed text-gray-500">{feature.description}</p>

      <ul className="space-y-1.5">
        {feature.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-[11px] text-gray-600">
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${feature.colorBg} ${feature.color.replace('text-', 'bg-')}`} />
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function IntegrationsSection() {
  const { ref, isVisible } = useReveal(0.1);

  return (
    <section id="integrations" className="bg-[#F8FAFC] py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div ref={ref} className="mb-14 text-center">
          <span
            className={`inline-block font-mono text-xs font-semibold uppercase tracking-widest text-teal transition-all duration-700 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            Todo integrado
          </span>
          <h2
            className={`mt-4 text-3xl font-bold text-navy transition-all duration-700 delay-100 sm:text-4xl ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
            }`}
          >
            Funcionalidades que trabajan por ti
          </h2>
          <p
            className={`mx-auto mt-4 max-w-2xl text-base text-gray-500 transition-all duration-700 delay-200 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
            }`}
          >
            Cada capacidad esta disenada para eliminar trabajo manual y darte resultados
            mas rapidos en tu proceso de contratacion.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <FeatureCard key={feature.name} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export { IntegrationsSection };
