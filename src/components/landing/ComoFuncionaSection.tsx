'use client';

import { useState, useRef } from 'react';
import {
  Briefcase, UserPlus, Brain, Phone, Calendar, FileText,
  BarChart2, CheckCircle, FolderOpen, UserCheck, PenLine,
} from 'lucide-react';

interface Paso {
  numero: number;
  titulo: string;
  descripcionCorta: string;
  descripcionLarga: string;
  detalles: string[];
  esIA: boolean;
  icono: React.ElementType;
  color: 'teal' | 'orange' | 'green' | 'navy';
}

const PASOS: Paso[] = [
  {
    numero: 1,
    titulo: 'Crear y publicar la vacante',
    descripcionCorta: 'Define el cargo, requisitos y publica en segundos',
    descripcionLarga: 'El reclutador crea la vacante con todos los detalles: cargo, descripcion, requisitos, salario, modalidad y habilidades clave. Con un clic se genera una URL publica y puede compartirse en LinkedIn.',
    detalles: [
      'Se genera automaticamente un portal publico con URL unica',
      'Puedes publicar en LinkedIn directamente desde Hirely con OAuth',
      'El portal muestra en tiempo real: cuantos candidatos han aplicado y hace cuantos dias esta activa',
    ],
    esIA: false,
    icono: Briefcase,
    color: 'navy',
  },
  {
    numero: 2,
    titulo: 'El candidato aplica desde el portal',
    descripcionCorta: 'Formulario publico con barra de progreso en 3 pasos',
    descripcionLarga: 'El candidato encuentra la vacante y completa un formulario de postulacion con datos personales, experiencia y CV. Recibe confirmacion por email al instante.',
    detalles: [
      'Formulario de 3 pasos con barra de progreso visual',
      'El CV se almacena de forma segura en AWS S3',
      'El candidato recibe email de confirmacion automaticamente al enviar',
    ],
    esIA: false,
    icono: UserPlus,
    color: 'navy',
  },
  {
    numero: 3,
    titulo: 'CV parseado y Score ATS calculado',
    descripcionCorta: 'Claude AI extrae datos y asigna puntaje 0-100 automaticamente',
    descripcionLarga: 'En segundos, Claude AI analiza el CV y extrae: experiencia laboral, educacion, habilidades, idiomas y certificaciones. Luego calcula un Score ATS en 6 dimensiones ponderadas para esa vacante especifica.',
    detalles: [
      '6 dimensiones: experiencia 30%, habilidades 25%, educacion 15%, idiomas 15%, certificaciones 10%, keywords 5%',
      'Score visual con colores: verde >=80, amarillo >=60, naranja >=40, rojo <40',
      'El umbral de "pasa el corte" es configurable por vacante',
    ],
    esIA: true,
    icono: Brain,
    color: 'orange',
  },
  {
    numero: 4,
    titulo: 'Entrevista IA por telefono',
    descripcionCorta: 'Agente de voz Dapta llama al candidato y evalua 5 competencias',
    descripcionLarga: 'Dapta realiza una llamada telefonica automatizada al candidato. La conversacion es analizada por Claude AI, que evalua competencias tecnicas y blandas y genera un score detallado con transcripcion completa.',
    detalles: [
      'El agente de voz conduce toda la entrevista sin intervencion del equipo de RRHH',
      'Claude evalua: competencia tecnica, comunicacion, resolucion de problemas, fit cultural y motivacion',
      'Genera transcripcion completa con timestamps y un informe de fortalezas y areas de mejora',
    ],
    esIA: true,
    icono: Phone,
    color: 'orange',
  },
  {
    numero: 5,
    titulo: 'Entrevista humana agendada',
    descripcionCorta: 'El reclutador agenda y se crea el evento en Google Calendar + Meet',
    descripcionLarga: 'El reclutador agenda la entrevista con fecha, hora y duracion. Hirely crea automaticamente el evento en Google Calendar con enlace Google Meet y envia la invitacion al candidato.',
    detalles: [
      'Integracion directa con Google Calendar: el evento aparece en el calendario de todos los participantes',
      'Email de invitacion al candidato con todos los datos: fecha, hora, enlace Meet y nombre del entrevistador',
      'El reclutador evalua por competencias (escala 1-10) y deja una recomendacion final',
    ],
    esIA: false,
    icono: Calendar,
    color: 'teal',
  },
  {
    numero: 6,
    titulo: 'Evaluacion tecnica enviada',
    descripcionCorta: 'Test online con tiempo limite, anti-trampa y scoring automatico',
    descripcionLarga: 'El candidato recibe un test tecnico por email con enlace tokenizado y tiempo limite de 72h. Las respuestas se califican automaticamente y las abiertas son evaluadas por Claude AI.',
    detalles: [
      'Banco de preguntas propio: opcion multiple, V/F, respuesta abierta y codigo. Puedes generar preguntas con IA',
      'Anti-trampa: detecta cambio de pestana, bloquea copy/paste y registra eventos sospechosos',
      'Scoring automatico al terminar — las respuestas abiertas y de codigo son evaluadas por Claude AI',
    ],
    esIA: true,
    icono: FileText,
    color: 'orange',
  },
  {
    numero: 7,
    titulo: 'Score final calculado',
    descripcionCorta: 'Formula configurable que consolida todas las evaluaciones',
    descripcionLarga: 'Hirely combina todos los scores en un unico puntaje final con pesos configurables. El equipo tiene una vista comparativa de todos los candidatos para tomar la decision final con datos.',
    detalles: [
      'Formula por defecto: ATS 20% + IA Dapta 25% + Humano 25% + Tecnico 30% (configurable)',
      'Vista de tabla comparativa con todos los candidatos ordenados por score final',
      'Alerta automatica si hay discrepancia mayor a 30 puntos entre evaluadores',
    ],
    esIA: true,
    icono: BarChart2,
    color: 'orange',
  },
  {
    numero: 8,
    titulo: 'Candidato seleccionado',
    descripcionCorta: 'Se genera el portal de documentos y se notifica a los demas',
    descripcionLarga: 'Al marcar al candidato como seleccionado, Hirely genera automaticamente un portal tokenizado para la recopilacion de documentos y envia un email de rechazo personalizado a los candidatos no seleccionados.',
    detalles: [
      'Portal con URL unica y token de seguridad, valido hasta que todos los documentos sean entregados',
      'Email automatico a candidatos no seleccionados con plantilla personalizable',
      'El checklist de documentos requeridos es configurable por organizacion',
    ],
    esIA: false,
    icono: CheckCircle,
    color: 'green',
  },
  {
    numero: 9,
    titulo: 'Documentos recopilados',
    descripcionCorta: 'El candidato sube sus documentos desde cualquier dispositivo',
    descripcionLarga: 'El candidato accede al portal desde su celular o computador y sube los documentos requeridos. El reclutador ve el progreso en tiempo real y recibe notificacion cuando el expediente esta completo.',
    detalles: [
      'Upload directo a AWS S3 — soporta archivos hasta 10MB (PDF, JPG, PNG, DOC)',
      'Panel con barra de progreso: "Documentos: 3 de 5 entregados"',
      'Notificacion en tiempo real al reclutador cuando todos los documentos estan completos',
    ],
    esIA: false,
    icono: FolderOpen,
    color: 'green',
  },
  {
    numero: 10,
    titulo: 'Candidato contratado',
    descripcionCorta: 'Contrato auto-generado con datos de la empresa y el candidato',
    descripcionLarga: 'Al marcar como contratado, Hirely envia el email de felicitaciones al candidato y genera automaticamente el borrador del contrato con todos los datos pre-poblados, listo para revision.',
    detalles: [
      '5 tipos de contrato colombiano: termino indefinido, termino fijo, prestacion de servicios, obra o labor, aprendizaje',
      'El contrato se auto-pobla con: datos del candidato, vacante, salario y datos legales de la empresa',
      'Email de felicitaciones al candidato se envia siempre, independiente del flujo del contrato',
    ],
    esIA: false,
    icono: UserCheck,
    color: 'green',
  },
  {
    numero: 11,
    titulo: 'Firma electronica y onboarding',
    descripcionCorta: 'Firma bilateral via SignWell, luego onboarding automatico',
    descripcionLarga: 'El contrato se envia para firma electronica: primero firma el candidato, luego la empresa. Al confirmar la firma bilateral, Hirely dispara automaticamente el email de bienvenida al equipo.',
    detalles: [
      'Firma bilateral via SignWell: candidato firma primero, la empresa confirma segundo',
      'Al confirmar la firma, el email de onboarding se envia automaticamente con plantilla personalizable',
      'Dashboard de onboarding muestra: contratados del mes, emails pendientes e inicios programados',
    ],
    esIA: false,
    icono: PenLine,
    color: 'green',
  },
];

const colorMap = {
  teal: { num: 'bg-[#00BCD4]', active: 'bg-[#00BCD4]/10 border-l-2 border-[#00BCD4]' },
  orange: { num: 'bg-[#FF6B35]', active: 'bg-[#FF6B35]/10 border-l-2 border-[#FF6B35]' },
  green: { num: 'bg-[#10B981]', active: 'bg-[#10B981]/10 border-l-2 border-[#10B981]' },
  navy: { num: 'bg-[#0A1F3F]', active: 'bg-[#0A1F3F]/10 border-l-2 border-[#0A1F3F]' },
};

export default function ComoFuncionaSection() {
  const [activo, setActivo] = useState(0);
  const [expanded, setExpanded] = useState(0);
  const mobileRef = useRef<HTMLDivElement>(null);

  const paso = PASOS[activo];
  const Icon = paso.icono;

  function handleMobileToggle(idx: number) {
    setExpanded(expanded === idx ? -1 : idx);
    setTimeout(() => {
      const el = document.getElementById(`paso-mobile-${idx}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  return (
    <section className="py-20 bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <p className="text-[#00BCD4] font-mono text-sm uppercase tracking-widest mb-3">
          Flujo completo
        </p>
        <h2 className="text-3xl sm:text-4xl font-black text-[#0A1F3F] mb-4">
          Como funciona Hirely?
        </h2>
        <p className="text-[#64748B] text-lg mb-4 max-w-2xl">
          Del candidato al contrato firmado en 11 pasos claros.
          Los pasos marcados con <span className="text-[#FF6B35] font-semibold">IA</span> ocurren
          automaticamente sin intervencion manual.
        </p>
        <div className="flex items-center gap-6 text-sm text-[#64748B] mb-12">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#00BCD4] inline-block" />
            Accion manual
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#FF6B35] inline-block" />
            Automatizado con IA
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#10B981] inline-block" />
            Candidato avanza
          </span>
        </div>

        {/* Desktop: two columns */}
        <div className="hidden lg:grid lg:grid-cols-[380px_1fr] gap-8">
          {/* Step list */}
          <div className="space-y-0 max-h-[640px] overflow-y-auto pr-2">
            {PASOS.map((p, i) => (
              <button
                key={p.numero}
                onClick={() => setActivo(i)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                  activo === i
                    ? `${colorMap[p.color].active} bg-opacity-100`
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Number circle */}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                      activo === i ? colorMap[p.color].num : 'bg-gray-300'
                    }`}>
                      {p.numero}
                    </div>
                    {i < PASOS.length - 1 && (
                      <div className="w-px h-6 border-l border-gray-200" />
                    )}
                  </div>
                  <div className="pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${activo === i ? 'text-[#0A1F3F]' : 'text-gray-600'}`}>
                        {p.titulo}
                      </span>
                      {p.esIA && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FF6B35]/10 text-[#FF6B35]">
                          IA
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">{p.descripcionCorta}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className="bg-white border border-gray-100 rounded-2xl p-8 sticky top-6 self-start">
            <div className="relative mb-6">
              <span className="text-7xl font-black text-gray-100 select-none leading-none">
                {String(paso.numero).padStart(2, '0')}
              </span>
              <div className={`absolute top-2 left-12 w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[paso.color].num}`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
            </div>

            <div key={activo} className="animate-fade-in">
              <h3 className="text-xl font-bold text-[#0A1F3F] mb-3">{paso.titulo}</h3>
              <p className="text-[#64748B] text-base leading-relaxed mb-5">
                {paso.descripcionLarga}
              </p>
              <div className="space-y-3 mb-5">
                {paso.detalles.map((d, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <CheckCircle className="h-4 w-4 text-[#00BCD4] mt-0.5 shrink-0" />
                    <span className="text-sm text-[#64748B]">{d}</span>
                  </div>
                ))}
              </div>
              {paso.esIA && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#FF6B35]/10 text-[#FF6B35]">
                  <Brain className="h-3.5 w-3.5" />
                  Automatizado con IA
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mobile: accordion */}
        <div ref={mobileRef} className="lg:hidden space-y-2">
          {PASOS.map((p, i) => {
            const PIcon = p.icono;
            const isOpen = expanded === i;
            return (
              <div key={p.numero} id={`paso-mobile-${i}`}>
                <button
                  onClick={() => handleMobileToggle(i)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                    isOpen ? colorMap[p.color].active : 'bg-white border border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${colorMap[p.color].num}`}>
                      {p.numero}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#0A1F3F]">{p.titulo}</span>
                        {p.esIA && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FF6B35]/10 text-[#FF6B35]">
                            IA
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-gray-400 text-sm">{isOpen ? '\u2212' : '+'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 py-4 bg-white border border-t-0 border-gray-100 rounded-b-lg animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[p.color].num}`}>
                        <PIcon className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-[#0A1F3F]">{p.titulo}</span>
                    </div>
                    <p className="text-sm text-[#64748B] mb-3">{p.descripcionLarga}</p>
                    <div className="space-y-2">
                      {p.detalles.map((d, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <CheckCircle className="h-3.5 w-3.5 text-[#00BCD4] mt-0.5 shrink-0" />
                          <span className="text-xs text-[#64748B]">{d}</span>
                        </div>
                      ))}
                    </div>
                    {p.esIA && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full bg-[#FF6B35]/10 text-[#FF6B35] mt-3">
                        <Brain className="h-3 w-3" />
                        Automatizado con IA
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
