'use client';

import { useReveal } from '@/hooks/useReveal';
import { Layers, Target, Clock, ArrowRight } from 'lucide-react';

const painPoints = [
  {
    icon: Layers,
    title: 'Procesos fragmentados',
    description:
      'Hojas de calculo, correos, carpetas compartidas y herramientas desconectadas. La informacion se pierde entre cada paso del proceso.',
  },
  {
    icon: Target,
    title: 'Decisiones subjetivas',
    description:
      'Sin datos estructurados ni scoring objetivo, la seleccion depende de la intuicion. Los sesgos invisibles afectan cada contratacion.',
  },
  {
    icon: Clock,
    title: 'Semanas de retraso',
    description:
      'Publicar vacantes, filtrar CVs, agendar entrevistas y gestionar documentos manualmente consume semanas de trabajo valioso.',
  },
];

export default function ProblemSection() {
  const { ref, isVisible } = useReveal(0.1);

  return (
    <section ref={ref} className="bg-[#F8FAFC] py-20">
      <div className="mx-auto max-w-6xl px-6">
        {/* Eyebrow */}
        <div
          className={`text-center transition-all duration-700 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          <span className="font-mono text-xs font-semibold uppercase tracking-widest text-teal">
            Por que Hirely?
          </span>
        </div>

        {/* Title */}
        <h2
          className={`mx-auto mt-4 max-w-3xl text-center text-3xl font-bold text-navy transition-all duration-700 delay-100 sm:text-4xl ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          El reclutamiento tradicional es lento, manual y sin datos
        </h2>

        {/* Cards */}
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {painPoints.map((point, i) => {
            const Icon = point.icon;
            return (
              <div
                key={point.title}
                className={`group rounded-2xl border border-gray-200/80 bg-white p-8 shadow-sm transition-all duration-700 hover:border-teal/40 hover:shadow-lg ${
                  isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                }`}
                style={{ transitionDelay: `${150 + i * 100}ms` }}
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-orange/10 text-orange transition-colors group-hover:bg-teal/10 group-hover:text-teal">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-navy">{point.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{point.description}</p>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div
          className={`mt-12 flex items-center justify-center gap-2 transition-all duration-700 delay-500 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <span className="font-semibold text-teal">Hirely resuelve todo esto</span>
          <ArrowRight className="h-5 w-5 text-teal" />
        </div>
      </div>
    </section>
  );
}
