'use client';

import Link from 'next/link';
import { useReveal } from '@/hooks/useReveal';
import { CheckCircle2 } from 'lucide-react';

const trustBadges = [
  'Sin tarjeta de credito',
  'Setup en 5 minutos',
  'Soporte en espanol',
];

export default function CtaSection() {
  const { ref, isVisible } = useReveal(0.1);

  return (
    <section
      className="relative overflow-hidden py-24"
      style={{
        background:
          'linear-gradient(135deg, #0A1F3F 0%, #003D4D 100%)',
      }}
    >
      {/* Radial teal glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 60% at 50% 50%, rgba(0,188,212,0.12) 0%, transparent 70%)',
        }}
      />

      <div ref={ref} className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <h2
          className={`text-3xl font-bold text-white transition-all duration-700 sm:text-4xl lg:text-5xl ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          Listo para contratar mejor, mas rapido?
        </h2>

        <p
          className={`mx-auto mt-5 max-w-xl text-lg text-white/60 transition-all duration-700 delay-100 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          Configura tu organizacion en minutos. Sin tarjeta de credito.
        </p>

        <div
          className={`mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row transition-all duration-700 delay-200 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-teal px-8 py-3.5 font-bold text-navy shadow-lg shadow-teal/20 transition-all hover:shadow-xl hover:shadow-teal/30 hover:brightness-110"
          >
            Comenzar gratis
          </Link>
          <button className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-8 py-3.5 font-medium text-white transition-all hover:border-white/50 hover:bg-white/5">
            Hablar con un asesor
          </button>
        </div>

        <div
          className={`mt-12 flex flex-wrap items-center justify-center gap-6 transition-all duration-700 delay-300 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          {trustBadges.map((badge) => (
            <span key={badge} className="inline-flex items-center gap-2 text-sm text-white/70">
              <CheckCircle2 className="h-4 w-4 text-teal" />
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export { CtaSection };
