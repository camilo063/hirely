import Link from 'next/link';
import { Briefcase, Users, Brain, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-light-bg">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal rounded-lg flex items-center justify-center font-bold text-white">
              H
            </div>
            <span className="text-xl font-bold text-navy">Hirely</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Iniciar sesion</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-teal hover:bg-teal/90 text-white">
                Comenzar gratis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-navy mb-6">
          Reclutamiento inteligente
          <br />
          <span className="text-teal">potenciado con IA</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Hirely automatiza tu proceso de seleccion con scoring ATS, entrevistas IA
          y firma electronica. Todo en una sola plataforma.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/register">
            <Button size="lg" className="bg-teal hover:bg-teal/90 text-white text-lg px-8">
              Comenzar ahora
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="text-lg px-8">
              Ver demo
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Briefcase,
              title: 'Gestion de Vacantes',
              description: 'Publica y gestiona vacantes con criterios de evaluacion ponderados.',
            },
            {
              icon: Users,
              title: 'Pipeline de Candidatos',
              description: 'Banco de talento con vista Kanban y scoring automatico.',
            },
            {
              icon: Brain,
              title: 'Entrevistas IA',
              description: 'Entrevistas automatizadas con analisis de competencias en tiempo real.',
            },
            {
              icon: FileCheck,
              title: 'Contratos y Firma',
              description: 'Genera contratos automaticamente y envialos a firma electronica.',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-xl p-6 border hover:shadow-lg transition-shadow"
            >
              <div className="h-12 w-12 rounded-lg bg-teal/10 flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-teal" />
              </div>
              <h3 className="font-semibold text-navy mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy text-white/60 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          <p>2026 Hirely. Plataforma de reclutamiento inteligente.</p>
        </div>
      </footer>
    </div>
  );
}
