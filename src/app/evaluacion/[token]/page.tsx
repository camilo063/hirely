'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Clock, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  AlertTriangle, FlaskConical, Loader2,
} from 'lucide-react';
import type { PreguntaAsignada, RespuestaCandidato, EstadoEvaluacion } from '@/lib/types/evaluacion-tecnica.types';

const DIFICULTAD_COLORS: Record<string, string> = {
  basico: 'bg-green-100 text-green-700',
  intermedio: 'bg-blue-100 text-blue-700',
  avanzado: 'bg-orange-100 text-orange-700',
  experto: 'bg-red-100 text-red-700',
};

type ViewState = 'loading' | 'welcome' | 'test' | 'submitted' | 'expired' | 'error';

interface EvalData {
  evaluacion: {
    id: string;
    titulo: string;
    duracion_minutos: number;
    puntaje_total: number;
    preguntas: PreguntaAsignada[];
    estado: EstadoEvaluacion;
    respuestas: RespuestaCandidato[];
    score_total: number | null;
    aprobada: boolean | null;
  };
  candidato_nombre: string;
  vacante_titulo: string;
  empresa_nombre: string;
  tiempo_restante_segundos: number | null;
}

export default function EvaluacionCandidatoPage() {
  const params = useParams();
  const token = params.token as string;

  const [view, setView] = useState<ViewState>('loading');
  const [data, setData] = useState<EvalData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [respuestas, setRespuestas] = useState<Map<string, string>>(new Map());
  const [startTimes, setStartTimes] = useState<Map<string, number>>(new Map());
  const [tiempoRestante, setTiempoRestante] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; aprobada: boolean; mostrar_resultados: boolean } | null>(null);

  useEffect(() => {
    fetchEvaluacion();
  }, [token]);

  async function fetchEvaluacion() {
    try {
      const res = await fetch(`/api/evaluaciones/responder/${token}`);
      const json = await res.json();
      if (!json.success || !json.data?.evaluacion) {
        setView('error');
        return;
      }
      const evalData = json.data as EvalData;
      setData(evalData);

      switch (evalData.evaluacion.estado) {
        case 'enviada':
          setView('welcome');
          break;
        case 'en_progreso':
          setView('test');
          if (evalData.tiempo_restante_segundos !== null) {
            setTiempoRestante(evalData.tiempo_restante_segundos);
          }
          // Restore previous answers if any
          if (evalData.evaluacion.respuestas?.length > 0) {
            const map = new Map<string, string>();
            evalData.evaluacion.respuestas.forEach(r => map.set(r.pregunta_id, r.respuesta));
            setRespuestas(map);
          }
          break;
        case 'completada':
          setView('submitted');
          break;
        case 'expirada':
          setView('expired');
          break;
        default:
          setView('error');
      }
    } catch {
      setView('error');
    }
  }

  // Timer
  useEffect(() => {
    if (view !== 'test' || tiempoRestante === null) return;
    if (tiempoRestante <= 0) {
      handleSubmit();
      return;
    }
    const interval = setInterval(() => {
      setTiempoRestante(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [view, tiempoRestante]);

  async function handleStart() {
    try {
      const res = await fetch(`/api/evaluaciones/responder/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'iniciar' }),
      });
      const json = await res.json();
      if (json.success) {
        setView('test');
        if (data) {
          setTiempoRestante(data.evaluacion.duracion_minutos * 60);
        }
        // Initialize start time for first question
        if (data?.evaluacion.preguntas[0]) {
          setStartTimes(new Map([[data.evaluacion.preguntas[0].pregunta_id, Date.now()]]));
        }
      }
    } catch {
      // error
    }
  }

  function setRespuesta(preguntaId: string, value: string) {
    const updated = new Map(respuestas);
    updated.set(preguntaId, value);
    setRespuestas(updated);
  }

  function goToQuestion(index: number) {
    if (!data) return;
    const preguntas = data.evaluacion.preguntas;
    if (index < 0 || index >= preguntas.length) return;

    // Track time for current question
    const currentPregunta = preguntas[currentIndex];
    const st = new Map(startTimes);
    if (!st.has(preguntas[index].pregunta_id)) {
      st.set(preguntas[index].pregunta_id, Date.now());
    }
    setStartTimes(st);
    setCurrentIndex(index);
  }

  const handleSubmit = useCallback(async () => {
    if (!data || submitting) return;
    setSubmitting(true);

    const respuestasArr: RespuestaCandidato[] = data.evaluacion.preguntas.map(p => {
      const startTime = startTimes.get(p.pregunta_id) || Date.now();
      return {
        pregunta_id: p.pregunta_id,
        respuesta: respuestas.get(p.pregunta_id) || '',
        tiempo_segundos: Math.floor((Date.now() - startTime) / 1000),
        respondida_at: new Date().toISOString(),
      };
    });

    try {
      const res = await fetch(`/api/evaluaciones/responder/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuestas: respuestasArr }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        setView('submitted');
      }
    } catch {
      // error
    } finally {
      setSubmitting(false);
    }
  }, [data, respuestas, startTimes, submitting, token]);

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ─── Views ───

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal" />
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 text-center">
            <XCircle className="h-16 w-16 mx-auto text-red-400 mb-4" />
            <h2 className="text-xl font-bold mb-2">Enlace no válido</h2>
            <p className="text-muted-foreground">
              Este enlace de evaluación no es válido o ya no está disponible.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === 'expired') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Evaluación expirada</h2>
            <p className="text-muted-foreground">
              El tiempo para completar esta evaluación ha expirado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === 'welcome' && data) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <FlaskConical className="h-12 w-12 text-teal" />
            </div>
            <CardTitle className="text-xl">Evaluación Técnica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-muted-foreground">
                Hola <strong>{data.candidato_nombre}</strong>, tienes una evaluación técnica para
              </p>
              <p className="text-lg font-semibold text-navy mt-1">{data.vacante_titulo}</p>
              <p className="text-sm text-muted-foreground">en {data.empresa_nombre}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 py-4 bg-soft-gray/50 rounded-lg px-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-navy">{data.evaluacion.preguntas.length}</p>
                <p className="text-xs text-muted-foreground">Preguntas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-navy">{data.evaluacion.duracion_minutos}</p>
                <p className="text-xs text-muted-foreground">Minutos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-navy">{data.evaluacion.puntaje_total}</p>
                <p className="text-xs text-muted-foreground">Puntos</p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>- El tiempo comienza al hacer clic en &quot;Comenzar&quot;</p>
              <p>- Puedes navegar entre preguntas libremente</p>
              <p>- Al terminar el tiempo, las respuestas se envían automáticamente</p>
            </div>

            <Button
              onClick={handleStart}
              className="w-full bg-teal hover:bg-teal/90 h-12 text-base"
            >
              Comenzar Evaluación
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === 'submitted') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-xl font-bold">Evaluación Enviada</h2>

            {result?.mostrar_resultados ? (
              <div>
                <p className={`text-4xl font-bold ${result.aprobada ? 'text-green-600' : 'text-red-500'}`}>
                  {result.score}/100
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.aprobada ? 'Aprobada' : 'No aprobada'}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Gracias, tu evaluación ha sido recibida. Te contactaremos pronto.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Test View ───
  if (view === 'test' && data) {
    const preguntas = data.evaluacion.preguntas;
    const pregunta = preguntas[currentIndex];
    const respondidas = preguntas.filter(p => respuestas.has(p.pregunta_id)).length;

    return (
      <div className="min-h-screen bg-[#F5F7FA]">
        {/* Top bar */}
        <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-navy">{data.evaluacion.titulo}</span>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {respondidas}/{preguntas.length} respondidas
              </span>
              {tiempoRestante !== null && (
                <Badge className={`gap-1 ${tiempoRestante < 300 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                  <Clock className="h-3 w-3" />
                  {formatTime(tiempoRestante)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Question nav dots */}
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <div className="flex flex-wrap gap-1 mb-4">
            {preguntas.map((p, i) => (
              <button
                key={p.pregunta_id}
                onClick={() => goToQuestion(i)}
                className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                  i === currentIndex
                    ? 'bg-teal text-white'
                    : respuestas.has(p.pregunta_id)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Question */}
        <div className="max-w-3xl mx-auto px-4 pb-24">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Pregunta {currentIndex + 1} de {preguntas.length}
                </span>
                <div className="flex gap-1">
                  <Badge variant="outline" className="text-[10px]">{pregunta.categoria}</Badge>
                  <Badge className={`${DIFICULTAD_COLORS[pregunta.dificultad]} text-[10px]`}>{pregunta.dificultad}</Badge>
                  <Badge variant="outline" className="text-[10px]">{pregunta.puntos} pts</Badge>
                </div>
              </div>
              <CardTitle className="text-base mt-2">{pregunta.enunciado}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Multiple choice */}
              {pregunta.tipo === 'opcion_multiple' && pregunta.opciones && (
                <div className="space-y-2">
                  {pregunta.opciones.map((op) => (
                    <button
                      key={op.id}
                      onClick={() => setRespuesta(pregunta.pregunta_id, op.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        respuestas.get(pregunta.pregunta_id) === op.id
                          ? 'border-teal bg-teal/5 ring-1 ring-teal'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-medium mr-2">{op.id})</span>
                      {op.texto}
                    </button>
                  ))}
                </div>
              )}

              {/* True/False */}
              {pregunta.tipo === 'verdadero_falso' && (
                <div className="flex gap-4">
                  {['verdadero', 'falso'].map((val) => (
                    <button
                      key={val}
                      onClick={() => setRespuesta(pregunta.pregunta_id, val)}
                      className={`flex-1 py-4 rounded-lg border text-center font-medium transition-colors ${
                        respuestas.get(pregunta.pregunta_id) === val
                          ? 'border-teal bg-teal/5 ring-1 ring-teal'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {val === 'verdadero' ? 'Verdadero' : 'Falso'}
                    </button>
                  ))}
                </div>
              )}

              {/* Open/Code */}
              {(pregunta.tipo === 'respuesta_abierta' || pregunta.tipo === 'codigo') && (
                <Textarea
                  value={respuestas.get(pregunta.pregunta_id) || ''}
                  onChange={(e) => setRespuesta(pregunta.pregunta_id, e.target.value)}
                  placeholder={pregunta.tipo === 'codigo' ? 'Escribe tu código aquí...' : 'Escribe tu respuesta...'}
                  rows={pregunta.tipo === 'codigo' ? 12 : 6}
                  className={pregunta.tipo === 'codigo' ? 'font-mono text-sm' : ''}
                />
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              onClick={() => goToQuestion(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>

            {currentIndex < preguntas.length - 1 ? (
              <Button
                onClick={() => goToQuestion(currentIndex + 1)}
                className="bg-teal hover:bg-teal/90 gap-1"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 gap-1"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Enviar Evaluación</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
