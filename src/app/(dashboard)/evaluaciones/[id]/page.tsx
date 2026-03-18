'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, Clock, Send, User, Briefcase, BarChart3,
} from 'lucide-react';
import type { Evaluacion, ScoreDetalle, PreguntaAsignada, RespuestaCandidato } from '@/lib/types/evaluacion-tecnica.types';

const DIFICULTAD_COLORS: Record<string, string> = {
  basico: 'bg-green-100 text-green-700',
  intermedio: 'bg-blue-100 text-blue-700',
  avanzado: 'bg-orange-100 text-orange-700',
  experto: 'bg-red-100 text-red-700',
};

const ESTADO_COLORS: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-700',
  enviada: 'bg-blue-100 text-blue-700',
  en_progreso: 'bg-yellow-100 text-yellow-700',
  completada: 'bg-green-100 text-green-700',
  expirada: 'bg-red-100 text-red-700',
  cancelada: 'bg-gray-200 text-gray-500',
};

export default function EvaluacionDetailPage() {
  const params = useParams();
  const [evaluacion, setEvaluacion] = useState<Evaluacion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvaluacion();
  }, []);

  async function fetchEvaluacion() {
    try {
      const res = await fetch(`/api/evaluaciones/${params.id}`);
      const data = await res.json();
      if (data.success) setEvaluacion(data.data);
      else toast.error('Error cargando evaluación');
    } catch {
      toast.error('Error');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnviar() {
    try {
      const res = await fetch(`/api/evaluaciones/${params.id}/enviar`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Evaluación enviada');
        fetchEvaluacion();
      } else {
        toast.error(data.error || 'Error');
      }
    } catch {
      toast.error('Error enviando');
    }
  }

  if (loading) return <TableSkeleton />;
  if (!evaluacion) return <div className="text-center py-12 text-muted-foreground">Evaluación no encontrada</div>;

  const preguntas: PreguntaAsignada[] = typeof evaluacion.preguntas === 'string'
    ? JSON.parse(evaluacion.preguntas)
    : evaluacion.preguntas || [];
  const respuestas: RespuestaCandidato[] = typeof evaluacion.respuestas === 'string'
    ? JSON.parse(evaluacion.respuestas)
    : evaluacion.respuestas || [];
  const scoreDetalle: ScoreDetalle | null = typeof evaluacion.score_detalle === 'string'
    ? JSON.parse(evaluacion.score_detalle)
    : evaluacion.score_detalle;
  const respuestaMap = new Map(respuestas.map(r => [r.pregunta_id, r]));

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <Breadcrumbs />

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{evaluacion.titulo}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {evaluacion.candidato_nombre} {evaluacion.candidato_apellido || ''}</span>
            <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {evaluacion.vacante_titulo}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={ESTADO_COLORS[evaluacion.estado]}>
            {evaluacion.estado.replace('_', ' ')}
          </Badge>
          {evaluacion.estado === 'pendiente' && (
            <Button size="sm" className="bg-teal hover:bg-teal/90 gap-1" onClick={handleEnviar}>
              <Send className="h-3.5 w-3.5" /> Enviar
            </Button>
          )}
        </div>
      </div>

      {/* Score summary */}
      {evaluacion.score_total !== null && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className={`text-3xl font-bold ${evaluacion.aprobada ? 'text-green-600' : 'text-red-500'}`}>
                {evaluacion.score_total}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Score Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-navy">{evaluacion.puntaje_aprobatorio}%</p>
              <p className="text-xs text-muted-foreground mt-1">Mínimo Aprobatorio</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center flex flex-col items-center justify-center">
              {evaluacion.aprobada ? (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
              <p className="text-sm font-medium mt-1">{evaluacion.aprobada ? 'Aprobada' : 'No Aprobada'}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Score by category */}
      {scoreDetalle && Object.keys(scoreDetalle).length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Desglose por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(scoreDetalle).map(([cat, data]) => (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{cat}</span>
                    <span className="text-sm">
                      {data.correctas}/{data.total} correctas — <strong>{data.score}%</strong>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${data.score >= 70 ? 'bg-green-500' : data.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${data.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Questions and answers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preguntas ({preguntas.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {preguntas.map((p, i) => {
            const resp = respuestaMap.get(p.pregunta_id);
            return (
              <div key={p.pregunta_id} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{i + 1}. {p.enunciado}</p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Badge variant="outline" className="text-[10px]">{p.categoria}</Badge>
                    <Badge className={`${DIFICULTAD_COLORS[p.dificultad]} text-[10px]`}>{p.dificultad}</Badge>
                    <Badge variant="outline" className="text-[10px]">{p.puntos} pts</Badge>
                  </div>
                </div>

                {/* Options display */}
                {p.opciones && (
                  <div className="mt-2 space-y-1">
                    {p.opciones.map((op) => (
                      <div
                        key={op.id}
                        className={`text-sm px-3 py-1.5 rounded ${
                          resp?.respuesta === op.id
                            ? 'bg-teal/10 border border-teal/30 font-medium'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {op.id}) {op.texto}
                      </div>
                    ))}
                  </div>
                )}

                {/* Open/code answer */}
                {!p.opciones && resp && (
                  <div className="mt-2 bg-soft-gray/50 rounded-lg p-3 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">Respuesta del candidato:</p>
                    <p className="whitespace-pre-wrap">{resp.respuesta}</p>
                  </div>
                )}

                {/* Time */}
                {resp && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {resp.tiempo_segundos}s
                  </div>
                )}

                {!resp && evaluacion.estado === 'completada' && (
                  <p className="text-xs text-red-400 mt-2">Sin respuesta</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
