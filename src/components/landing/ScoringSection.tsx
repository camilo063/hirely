'use client';

import { useReveal } from '@/hooks/useReveal';
import { FileSearch, Bot, User, Code } from 'lucide-react';

interface Dimension {
  label: string;
  value: number;
}

interface ScoreCard {
  title: string;
  weight: string;
  icon: React.ElementType;
  accent: string;
  accentBg: string;
  barColor: string;
  dimensions?: Dimension[];
  features?: string[];
}

const scoreCards: ScoreCard[] = [
  {
    title: 'Score ATS',
    weight: '20%',
    icon: FileSearch,
    accent: 'text-orange',
    accentBg: 'bg-orange/10',
    barColor: 'bg-orange',
    dimensions: [
      { label: 'Experiencia relevante', value: 85 },
      { label: 'Educacion', value: 72 },
      { label: 'Habilidades tecnicas', value: 90 },
      { label: 'Habilidades blandas', value: 68 },
      { label: 'Certificaciones', value: 55 },
      { label: 'Idiomas', value: 80 },
    ],
  },
  {
    title: 'Score IA',
    weight: '25%',
    icon: Bot,
    accent: 'text-teal',
    accentBg: 'bg-teal/10',
    barColor: 'bg-teal',
    dimensions: [
      { label: 'Comunicacion', value: 88 },
      { label: 'Conocimiento tecnico', value: 76 },
      { label: 'Resolucion de problemas', value: 82 },
      { label: 'Motivacion', value: 70 },
      { label: 'Fit cultural', value: 65 },
    ],
  },
  {
    title: 'Score Humano',
    weight: '25%',
    icon: User,
    accent: 'text-[#7C3AED]',
    accentBg: 'bg-[#7C3AED]/10',
    barColor: 'bg-[#7C3AED]',
    dimensions: [
      { label: 'Presencia profesional', value: 78 },
      { label: 'Profundidad tecnica', value: 84 },
      { label: 'Liderazgo', value: 62 },
      { label: 'Trabajo en equipo', value: 90 },
      { label: 'Potencial de crecimiento', value: 75 },
    ],
  },
  {
    title: 'Score Tecnico',
    weight: '30%',
    icon: Code,
    accent: 'text-[#10B981]',
    accentBg: 'bg-[#10B981]/10',
    barColor: 'bg-[#10B981]',
    features: [
      'Preguntas de opcion multiple con autocalificacion',
      'Preguntas abiertas evaluadas con IA',
      'Ejercicios de codigo con validacion automatica',
      'Evaluaciones multi-seccion con limite de tiempo',
      'Banco de preguntas por area y nivel',
      'Generacion de preguntas con Claude AI',
    ],
  },
];

function AnimatedBar({
  value,
  color,
  isVisible,
  delay,
}: {
  value: number;
  color: string;
  isVisible: boolean;
  delay: number;
}) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full ${color} transition-all duration-1000 ease-out`}
        style={{
          width: isVisible ? `${value}%` : '0%',
          transitionDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}

function ScoreCardComponent({ card, index }: { card: ScoreCard; index: number }) {
  const { ref, isVisible } = useReveal(0.1);
  const Icon = card.icon;

  return (
    <div
      ref={ref}
      className={`rounded-2xl border border-white/5 bg-white/[0.03] p-6 transition-all duration-700 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.accentBg}`}
          >
            <Icon className={`h-5 w-5 ${card.accent}`} />
          </div>
          <div>
            <h3 className="font-bold text-white">{card.title}</h3>
            <span className="font-mono text-xs text-white/40">Peso: {card.weight}</span>
          </div>
        </div>
      </div>

      {/* Dimensions with animated bars */}
      {card.dimensions && (
        <div className="space-y-3">
          {card.dimensions.map((dim, i) => (
            <div key={dim.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-white/50">{dim.label}</span>
                <span
                  className={`font-mono text-xs font-bold ${card.accent} transition-all duration-700`}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transitionDelay: `${i * 80 + 300}ms`,
                  }}
                >
                  {dim.value}
                </span>
              </div>
              <AnimatedBar
                value={dim.value}
                color={card.barColor}
                isVisible={isVisible}
                delay={i * 80 + 200}
              />
            </div>
          ))}
        </div>
      )}

      {/* Features list */}
      {card.features && (
        <ul className="space-y-2.5">
          {card.features.map((feature, i) => (
            <li
              key={feature}
              className={`flex items-start gap-2 text-sm text-white/55 transition-all duration-500 ${
                isVisible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
              }`}
              style={{ transitionDelay: `${i * 60 + 200}ms` }}
            >
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${card.barColor}`} />
              {feature}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const rangeSegments = [
  { label: '< 50', sublabel: 'No apto', color: 'bg-red-500', textColor: 'text-red-400', width: 'w-[20%]' },
  { label: '50 - 69', sublabel: 'Revisar', color: 'bg-orange', textColor: 'text-orange', width: 'w-[25%]' },
  { label: '70 - 84', sublabel: 'Apto', color: 'bg-teal', textColor: 'text-teal', width: 'w-[30%]' },
  { label: '85+', sublabel: 'Excelente', color: 'bg-[#10B981]', textColor: 'text-[#10B981]', width: 'w-[25%]' },
];

export default function ScoringSection() {
  const { ref: headerRef, isVisible: headerVisible } = useReveal(0.1);
  const { ref: barRef, isVisible: barVisible } = useReveal(0.1);

  return (
    <section className="bg-[#0A1F3F] py-20">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div ref={headerRef} className="mb-14 text-center">
          <span
            className={`inline-block font-mono text-xs font-semibold uppercase tracking-widest text-teal transition-all duration-700 ${
              headerVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            Decisiones basadas en datos
          </span>
          <h2
            className={`mt-4 text-3xl font-bold text-white transition-all duration-700 delay-100 sm:text-4xl ${
              headerVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
            }`}
          >
            4 fuentes de scoring. 1 decision objetiva.
          </h2>
        </div>

        {/* Score cards grid */}
        <div className="grid gap-6 sm:grid-cols-2">
          {scoreCards.map((card, i) => (
            <ScoreCardComponent key={card.title} card={card} index={i} />
          ))}
        </div>

        {/* Range bar */}
        <div
          ref={barRef}
          className={`mt-14 transition-all duration-700 ${
            barVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          <p className="mb-4 text-center text-sm font-medium text-white/40">
            Rangos de score final
          </p>
          <div className="mx-auto flex max-w-2xl overflow-hidden rounded-xl">
            {rangeSegments.map((seg) => (
              <div
                key={seg.label}
                className={`${seg.width} ${seg.color} flex flex-col items-center justify-center py-3 transition-all duration-1000`}
                style={{ opacity: barVisible ? 1 : 0.3 }}
              >
                <span className="text-xs font-bold text-white">{seg.label}</span>
                <span className="text-[10px] text-white/70">{seg.sublabel}</span>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-3 flex max-w-2xl justify-between px-1">
            <span className="text-[10px] text-white/30">0</span>
            <span className="text-[10px] text-white/30">100</span>
          </div>
        </div>
      </div>
    </section>
  );
}
