'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScoringDualDashboard } from '@/components/entrevistas/scoring-dual-dashboard';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  BarChart3, FlaskConical, BookOpen, FileText,
  Send, Clock, CheckCircle2, XCircle, Plus,
} from 'lucide-react';
import type { Evaluacion } from '@/lib/types/evaluacion-tecnica.types';

interface Vacante {
  id: string;
  titulo: string;
}

const ESTADO_EVAL_COLORS: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-700',
  enviada: 'bg-blue-100 text-blue-700',
  en_progreso: 'bg-yellow-100 text-yellow-700',
  completada: 'bg-green-100 text-green-700',
  expirada: 'bg-red-100 text-red-700',
  cancelada: 'bg-gray-200 text-gray-500',
};

const ESTADO_EVAL_ICONS: Record<string, typeof Clock> = {
  pendiente: Clock,
  enviada: Send,
  en_progreso: FlaskConical,
  completada: CheckCircle2,
  expirada: XCircle,
  cancelada: XCircle,
};

export default function EvaluacionesPage() {
  const router = useRouter();
  const [vacantes, setVacantes] = useState<Vacante[]>([]);
  const [selectedVacante, setSelectedVacante] = useState<string>('');
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingScores, setLoadingScores] = useState(false);
  const [loadingEvals, setLoadingEvals] = useState(false);
  const [filterEstado, setFilterEstado] = useState<string>('');
  const [filterVacanteEval, setFilterVacanteEval] = useState<string>('');

  useEffect(() => {
    fetchVacantes();
    fetchEvaluaciones();
  }, []);

  useEffect(() => {
    if (selectedVacante) {
      fetchScores(selectedVacante);
    }
  }, [selectedVacante]);

  async function fetchVacantes() {
    try {
      const res = await fetch('/api/vacantes');
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        setVacantes(data.data);
        setSelectedVacante(data.data[0].id);
      }
    } catch {
      toast.error('Error cargando vacantes');
    } finally {
      setLoading(false);
    }
  }

  async function fetchScores(vacanteId: string) {
    setLoadingScores(true);
    try {
      const res = await fetch(`/api/scoring/dual?vacante_id=${vacanteId}`);
      const data = await res.json();
      if (data.success) {
        setCandidatos(data.data || []);
      }
    } catch {
      console.error('Error fetching scores');
    } finally {
      setLoadingScores(false);
    }
  }

  async function fetchEvaluaciones() {
    setLoadingEvals(true);
    try {
      const params = new URLSearchParams();
      if (filterVacanteEval) params.set('vacante_id', filterVacanteEval);
      if (filterEstado) params.set('estado', filterEstado);
      const res = await fetch(`/api/evaluaciones?${params}`);
      const data = await res.json();
      if (data.success) {
        setEvaluaciones(data.data || []);
      }
    } catch {
      console.error('Error fetching evaluaciones');
    } finally {
      setLoadingEvals(false);
    }
  }

  useEffect(() => {
    fetchEvaluaciones();
  }, [filterEstado, filterVacanteEval]);

  async function handleEnviar(evalId: string) {
    try {
      const res = await fetch(`/api/evaluaciones/${evalId}/enviar`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Evaluación enviada al candidato');
        fetchEvaluaciones();
      } else {
        toast.error(data.error || 'Error enviando evaluación');
      }
    } catch {
      toast.error('Error enviando evaluación');
    }
  }

  if (loading) return <TableSkeleton />;

  const filteredEvals = evaluaciones;

  return (
    <div className="animate-fade-in">
      <Breadcrumbs />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Evaluaciones</h1>
          <p className="text-muted-foreground">Scoring dual, pruebas técnicas y banco de preguntas</p>
        </div>
      </div>

      <Tabs defaultValue="scoring" className="space-y-4">
        <TabsList className="bg-soft-gray">
          <TabsTrigger value="scoring" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Scoring Dual
          </TabsTrigger>
          <TabsTrigger value="tecnicas" className="gap-1.5">
            <FlaskConical className="h-4 w-4" />
            Evaluaciones Técnicas
          </TabsTrigger>
          <TabsTrigger value="banco" className="gap-1.5" onClick={() => router.push('/evaluaciones/banco-preguntas')}>
            <BookOpen className="h-4 w-4" />
            Banco de Preguntas
          </TabsTrigger>
          <TabsTrigger value="plantillas" className="gap-1.5" onClick={() => router.push('/evaluaciones/plantillas')}>
            <FileText className="h-4 w-4" />
            Plantillas
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Scoring Dual */}
        <TabsContent value="scoring">
          <div className="mb-4">
            <select
              value={selectedVacante}
              onChange={(e) => setSelectedVacante(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-white"
            >
              {vacantes.map((v) => (
                <option key={v.id} value={v.id}>{v.titulo}</option>
              ))}
            </select>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Formula de Scoring</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-soft-gray rounded-lg p-4 text-center">
                <p className="text-sm font-mono">
                  Score Final = (Score IA x 25%) + (Score Humano x 25%) + (Score Técnico x 30%) + (Score ATS x 20%)
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Alerta de discrepancia cuando |Score IA - Score Humano| &gt; 30 puntos.
              </p>
            </CardContent>
          </Card>

          {loadingScores ? <TableSkeleton /> : <ScoringDualDashboard candidatos={candidatos} />}
        </TabsContent>

        {/* Tab 2: Evaluaciones Técnicas */}
        <TabsContent value="tecnicas">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <select
                value={filterVacanteEval}
                onChange={(e) => setFilterVacanteEval(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Todas las vacantes</option>
                {vacantes.map((v) => (
                  <option key={v.id} value={v.id}>{v.titulo}</option>
                ))}
              </select>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="enviada">Enviada</option>
                <option value="en_progreso">En progreso</option>
                <option value="completada">Completada</option>
                <option value="expirada">Expirada</option>
              </select>
            </div>
            <Link href="/evaluaciones/nueva">
              <Button className="bg-teal hover:bg-teal/90 gap-1.5">
                <Plus className="h-4 w-4" />
                Nueva Evaluación
              </Button>
            </Link>
          </div>

          {loadingEvals ? (
            <TableSkeleton />
          ) : filteredEvals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground">No hay evaluaciones técnicas</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Crea una evaluación desde el botón &quot;Nueva Evaluación&quot;
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-soft-gray/50">
                      <th className="text-left px-4 py-3 font-medium">Candidato</th>
                      <th className="text-left px-4 py-3 font-medium">Vacante</th>
                      <th className="text-left px-4 py-3 font-medium">Evaluación</th>
                      <th className="text-center px-4 py-3 font-medium">Estado</th>
                      <th className="text-center px-4 py-3 font-medium">Score</th>
                      <th className="text-center px-4 py-3 font-medium">Enviada</th>
                      <th className="text-center px-4 py-3 font-medium">Completada</th>
                      <th className="text-center px-4 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvals.map((ev) => {
                      const Icon = ESTADO_EVAL_ICONS[ev.estado] || Clock;
                      return (
                        <tr key={ev.id} className="border-b hover:bg-soft-gray/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{ev.candidato_nombre} {ev.candidato_apellido || ''}</div>
                            <div className="text-xs text-muted-foreground">{ev.candidato_email}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{ev.vacante_titulo}</td>
                          <td className="px-4 py-3">{ev.titulo}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={`${ESTADO_EVAL_COLORS[ev.estado] || ''} gap-1`}>
                              <Icon className="h-3 w-3" />
                              {ev.estado.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {ev.score_total !== null ? (
                              <span className={`font-bold ${ev.aprobada ? 'text-green-600' : 'text-red-500'}`}>
                                {ev.score_total}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                            {ev.enviada_at ? new Date(ev.enviada_at).toLocaleDateString('es') : '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                            {ev.completada_at ? new Date(ev.completada_at).toLocaleDateString('es') : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {ev.estado === 'pendiente' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => handleEnviar(ev.id)}
                                >
                                  <Send className="h-3 w-3" />
                                  Enviar
                                </Button>
                              )}
                              {ev.estado === 'completada' && (
                                <Link href={`/evaluaciones/${ev.id}`}>
                                  <Button size="sm" variant="outline" className="h-7 text-xs">
                                    Ver resultados
                                  </Button>
                                </Link>
                              )}
                              {(ev.estado === 'enviada' || ev.estado === 'en_progreso') && (
                                <Badge variant="outline" className="text-xs">
                                  Esperando...
                                </Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Banco de Preguntas y Plantillas navegan directamente via onClick en sus TabsTriggers */}
      </Tabs>
    </div>
  );
}
