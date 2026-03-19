'use client';

import { useReveal } from '@/hooks/useReveal';
import { Star } from 'lucide-react';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
  initials: string;
  avatarBg: string;
}

const testimonials: Testimonial[] = [
  {
    quote:
      'Pasamos de 3 semanas a 5 dias por contratacion. El scoring IA nos ahorra horas de revision manual.',
    name: 'Maria Gonzalez',
    role: 'Gerente RRHH',
    company: 'Constructora Andina',
    initials: 'MG',
    avatarBg: 'bg-teal',
  },
  {
    quote:
      'Las entrevistas de voz con Dapta son increibles. El candidato recibe la llamada y nosotros obtenemos el analisis completo.',
    name: 'Carlos Mejia',
    role: 'Talent Acquisition',
    company: 'Fintech Colombia',
    initials: 'CM',
    avatarBg: 'bg-navy',
  },
  {
    quote:
      'La firma digital de contratos con SignWell cerro el ciclo completo. Ya no usamos papel para nada.',
    name: 'Ana Rodriguez',
    role: 'HR Manager',
    company: 'SaaS Bogota',
    initials: 'AR',
    avatarBg: 'bg-success',
  },
];

function Stars() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-teal text-teal" />
      ))}
    </div>
  );
}

function TestimonialCard({ testimonial, index }: { testimonial: Testimonial; index: number }) {
  const { ref, isVisible } = useReveal(0.05);

  return (
    <div
      ref={ref}
      className={`flex flex-col rounded-2xl border border-gray-200/80 bg-white p-8 shadow-sm transition-all duration-500 hover:shadow-lg ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      <Stars />

      <blockquote className="mt-5 flex-1 text-base italic leading-relaxed text-gray-600">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>

      <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-6">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full ${testimonial.avatarBg} text-sm font-bold text-white`}
        >
          {testimonial.initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-navy">{testimonial.name}</p>
          <p className="text-xs text-gray-500">
            {testimonial.role}, {testimonial.company}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TestimonialsSection() {
  const { ref, isVisible } = useReveal(0.1);

  return (
    <section className="bg-[#F8FAFC] py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div ref={ref} className="mb-14 text-center">
          <span
            className={`inline-block font-mono text-xs font-semibold uppercase tracking-widest text-teal transition-all duration-700 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            Confiado por equipos de RRHH
          </span>
          <h2
            className={`mt-4 text-3xl font-bold text-navy transition-all duration-700 delay-100 sm:text-4xl ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
            }`}
          >
            Lo que dicen los reclutadores
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial, i) => (
            <TestimonialCard key={testimonial.name} testimonial={testimonial} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export { TestimonialsSection };
