'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, X, ArrowRight, Clock } from 'lucide-react';

interface ChecklistPaso {
  id: string;
  paso: string;
  completado: boolean;
}

const PASOS_CONFIG = [
  {
    id: 'empresa',
    titulo: 'Configura los datos de tu empresa',
    descripcion: 'Agrega NIT, representante legal y direccion. Se usan en todos los contratos generados.',
    href: '/configuracion?tab=empresa',
    cta: 'Ir a Configuracion',
    tiempoEstimado: '2 min',
  },
  {
    id: 'vacante',
    titulo: 'Crea tu primera vacante',
    descripcion: 'Publica el primer cargo y activa el portal publico de postulaciones.',
    href: '/vacantes/nueva',
    cta: 'Crear vacante',
    tiempoEstimado: '5 min',
  },
  {
    id: 'candidato',
    titulo: 'Agrega o invita tu primer candidato',
    descripcion: 'Puedes cargar candidatos manualmente o compartir el enlace del portal para que apliquen.',
    href: '/candidatos/nuevo',
    cta: 'Agregar candidato',
    tiempoEstimado: '2 min',
  },
  {
    id: 'email_template',
    titulo: 'Personaliza las plantillas de email',
    descripcion: 'Edita los emails de seleccion, rechazo y onboarding con el tono de tu empresa.',
    href: '/configuracion?tab=emails',
    cta: 'Ir a Emails',
    tiempoEstimado: '5 min',
  },
  {
    id: 'portal_test',
    titulo: 'Prueba el portal publico como candidato',
    descripcion: 'Copia el enlace de tu vacante y abre en una pestana de incognito para ver la experiencia del candidato.',
    href: null,
    cta: null,
    tiempoEstimado: '3 min',
  },
];

export function OnboardingChecklist() {
  const router = useRouter();
  const [pasos, setPasos] = useState<ChecklistPaso[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [showDoneMsg, setShowDoneMsg] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/onboarding-checklist');
        const data = await res.json();
        if (data.dismissed) {
          setDismissed(true);
        } else {
          setPasos(data.pasos || []);
          if (data.todoCompleto) {
            setAllDone(true);
            setShowDoneMsg(true);
            setTimeout(() => setDismissed(true), 4000);
          }
        }
      } catch {
        setDismissed(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleDismiss() {
    setDismissed(true);
    try {
      await fetch('/api/onboarding-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      });
    } catch { /* silent */ }
  }

  if (loading || dismissed) return null;

  const completados = pasos.filter(p => p.completado).length;
  const total = pasos.length;
  const progressPercent = total > 0 ? Math.round((completados / total) * 100) : 0;
  const primerIncompleto = pasos.findIndex(p => !p.completado);

  if (showDoneMsg) {
    return (
      <div className="bg-gradient-to-r from-[#10B981] to-[#10B981]/90 rounded-2xl p-6 text-white mb-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-6 w-6" />
          <div>
            <p className="font-semibold text-lg">Hirely esta configurado</p>
            <p className="text-sm opacity-80">Todos los pasos completados. Ya puedes gestionar tu proceso de reclutamiento.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-[#0A1F3F] to-[#0A1F3F]/90 rounded-2xl p-6 text-white mb-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-lg font-semibold">Bienvenido a Hirely!</p>
          <p className="text-sm text-white/60">Completa estos {total} pasos para dejarlo listo.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/50">{completados} de {total}</span>
          <button onClick={handleDismiss} className="text-white/40 hover:text-white/80 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2 mb-5">
        {PASOS_CONFIG.map((config, i) => {
          const pasoData = pasos.find(p => p.paso === config.id);
          const completado = pasoData?.completado ?? false;
          const isActive = i === primerIncompleto;

          return (
            <div
              key={config.id}
              className={`rounded-xl transition-all ${
                completado
                  ? 'px-4 py-2.5'
                  : isActive
                  ? 'border border-[#00BCD4]/30 p-4 bg-white/5'
                  : 'px-4 py-2.5 opacity-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {completado ? (
                  <CheckCircle className="h-5 w-5 text-[#10B981] mt-0.5 shrink-0" />
                ) : (
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 ${isActive ? 'border-[#00BCD4]' : 'border-white/30'}`} />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${completado ? 'line-through opacity-60' : ''}`}>
                    {config.titulo}
                  </p>
                  {isActive && !completado && (
                    <>
                      <p className="text-xs text-white/50 mt-1">{config.descripcion}</p>
                      <div className="flex items-center gap-3 mt-3">
                        {config.href && config.cta && (
                          <button
                            onClick={() => router.push(config.href!)}
                            className="inline-flex items-center gap-1.5 bg-[#00BCD4] text-[#0A1F3F] font-semibold text-xs px-4 py-2 rounded-lg hover:bg-[#00BCD4]/90 transition-colors"
                          >
                            {config.cta} <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                        <span className="flex items-center gap-1 text-[10px] text-white/40">
                          <Clock className="h-3 w-3" /> ~{config.tiempoEstimado}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#00BCD4] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-[10px] text-white/40 mt-1.5">{completados} de {total} completados</p>
      </div>
    </div>
  );
}
