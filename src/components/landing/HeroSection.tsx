'use client';

import Link from 'next/link';
import { useReveal } from '@/hooks/useReveal';
import { Sparkles, ArrowRight, Play } from 'lucide-react';

const pipelineSteps = [
  { label: 'Nuevo', color: 'bg-teal' },
  { label: 'Revisado', color: 'bg-teal-400' },
  { label: 'Preseleccionado', color: 'bg-orange' },
  { label: 'Entrevista', color: 'bg-[#7C3AED]' },
  { label: 'Contratado', color: 'bg-success' },
];

const stats = [
  { value: '10', label: 'Modulos' },
  { value: '7', label: 'Integraciones' },
  { value: '90%', label: 'MVP Completo' },
];

export default function HeroSection() {
  const { ref, isVisible } = useReveal(0.1);

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0A1F3F]"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 60% 50% at 80% 10%, rgba(0,188,212,0.15) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 15% 90%, rgba(255,107,53,0.10) 0%, transparent 60%)',
      }}
    >
      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 text-center">
        {/* Eyebrow badge */}
        <div
          className={`mb-8 inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-4 py-2 transition-all duration-700 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <Sparkles className="h-4 w-4 text-teal" />
          <span className="font-mono text-xs tracking-wide text-teal">
            Powered by Claude AI &middot; Dapta &middot; SignWell
          </span>
        </div>

        {/* Heading */}
        <h1
          className={`mx-auto max-w-4xl font-black leading-[1.08] transition-all duration-700 delay-100 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          <span className="block text-4xl text-white sm:text-5xl lg:text-7xl">
            Reclutamiento inteligente,
          </span>
          <span className="block text-4xl text-teal sm:text-5xl lg:text-7xl">
            del CV al contrato firmado.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className={`mx-auto mt-6 max-w-2xl text-lg text-white/65 transition-all duration-700 delay-200 sm:text-xl ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          Hirely automatiza todo el ciclo de seleccion: publicacion de vacantes, parsing de CV con
          IA, entrevistas, evaluaciones tecnicas, firma digital y onboarding. Todo en una sola
          plataforma.
        </p>

        {/* Stat badges */}
        <div
          className={`mt-8 flex flex-wrap items-center justify-center gap-3 transition-all duration-700 delay-300 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          {stats.map((stat) => (
            <span
              key={stat.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/80"
            >
              <span className="font-bold text-teal">{stat.value}</span>
              {stat.label}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div
          className={`mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row transition-all duration-700 delay-[400ms] ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 rounded-lg bg-teal px-8 py-3.5 font-bold text-[#0A1F3F] shadow-lg shadow-teal/20 transition-all hover:shadow-xl hover:shadow-teal/30 hover:brightness-110"
          >
            Comenzar gratis
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-lg border border-white/30 px-8 py-3.5 font-medium text-white transition-all hover:border-white/50 hover:bg-white/5"
          >
            <Play className="h-4 w-4" />
            Ver demo
          </Link>
        </div>

        {/* Mini pipeline */}
        <div
          className={`mt-16 transition-all duration-700 delay-500 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          <div className="mx-auto flex max-w-xl items-center justify-between">
            {pipelineSteps.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <div
                      className={`h-4 w-4 rounded-full ${step.color} shadow-lg transition-all duration-500`}
                      style={{
                        animationDelay: `${i * 200}ms`,
                        boxShadow: `0 0 12px ${
                          i === 0
                            ? 'rgba(0,188,212,0.4)'
                            : i === 1
                            ? 'rgba(0,188,212,0.3)'
                            : i === 2
                            ? 'rgba(255,107,53,0.4)'
                            : i === 3
                            ? 'rgba(124,58,237,0.4)'
                            : 'rgba(16,185,129,0.4)'
                        }`,
                      }}
                    />
                    {isVisible && (
                      <div
                        className={`absolute inset-0 animate-ping rounded-full ${step.color} opacity-30`}
                        style={{ animationDelay: `${i * 300}ms`, animationDuration: '2s' }}
                      />
                    )}
                  </div>
                  <span className="hidden text-[10px] font-medium text-white/50 sm:block">
                    {step.label}
                  </span>
                </div>
                {i < pipelineSteps.length - 1 && (
                  <div className="relative mx-2 h-[2px] w-8 overflow-hidden rounded-full bg-white/10 sm:mx-3 sm:w-12">
                    {isVisible && (
                      <div
                        className="absolute inset-y-0 left-0 w-full animate-pulse rounded-full bg-gradient-to-r from-teal/60 to-white/20"
                        style={{
                          animationDelay: `${i * 200 + 500}ms`,
                          animationDuration: '2s',
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
