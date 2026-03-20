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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  BarChart3, FlaskConical, BookOpen, FileText,
  Send, Clock, CheckCircle2, XCircle, Plus, Users,
  Loader2,
} from 'lucide-react';
import type { Evaluacion } from '@/lib/types/evaluacion-tecnica.types';

interface Vacante {
  id: string;
  titulo: string;
}

interface Plantilla {
  id: string;
  nombre: string;
  duracion_minutos: number;
  puntaje_aprobatorio: number;
  estado: string;
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

interface CandidatoElegible {
  aplicacion_id: string;
  candidato_id: string;
  nombre: string;
  apellido: string;
  email: string;
  estado: string;
  eval_previa_estado: string | null;
  eval_previa_score: number | null;
  eval_previa_fecha: string | null;
  tiene_eval_activa: boolean;
}

function EnvioMasivoDialog({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [vacantesLocal, setVacantesLocal] = useState<Vacante[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [selectedVacante, setSelectedVacante] = useState('');
  const [selectedPlantilla, setSelectedPlantilla] = useState('');
  const [candidatos, setCandidatos] = useState<CandidatoElegible[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingCandidatos, setLoadingCandidatos] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch vacantes + plantillas when dialog opens
  useEffect(() => {
    if (!open) return;
    fetch('/api/vacantes?estado=publicada&limit=100')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const arr = data.data?.data || data.data || [];
          setVacantesLocal(arr);
        }
      })
      .catch(() => toast.error('Error cargando vacantes'));

    fetch('/api/evaluaciones/plantillas')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPlantillas((data.data || []).filter((p: Plantilla) => p.estado === 'activa'));
        }
      })
      .catch(() => toast.error('Error cargando plantillas'));
  }, [open]);

  // Fetch candidatos when vacante changes
  useEffect(() => {
    if (!selectedVacante) {
      setCandidatos([]);
      setSelectedIds(new Set());
      return;
    }
    setLoadingCandidatos(true);
    fetch(`/api/evaluaciones/envio-masivo?vacante_id=${selectedVacante}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const cands = data.data?.candidatos || [];
          setCandidatos(cands);
          // Pre-select those without active evaluation and without completed one
          const preSelected = new Set<string>(
            cands
              .filter((c: CandidatoElegible) => !c.tiene_eval_activa && !c.eval_previa_estado)
              .map((c: CandidatoElegible) => c.aplicacion_id)
          );
          setSelectedIds(preSelected);
        }
      })
      .catch(() => setCandidatos([]))
      .finally(() => setLoadingCandidatos(false));
  }, [selectedVacante]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setSelectedVacante('');
      setSelectedPlantilla('');
      setCandidatos([]);
      setSelectedIds(new Set());
    }
  }

  function toggleCandidate(aplicacionId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(aplicacionId)) next.delete(aplicacionId);
      else next.add(aplicacionId);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === candidatos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidatos.map(c => c.aplicacion_id)));
    }
  }

  async function handleSubmit() {
    if (!selectedVacante || !selectedPlantilla || selectedIds.size === 0) return;
    setSending(true);
    try {
      const res = await fetch('/api/evaluaciones/envio-masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacante_id: selectedVacante,
          plantilla_id: selectedPlantilla,
          candidatos_ids: Array.from(selectedIds),
        }),
      });
      const data = await res.json();
      if (data.success) {
        const { enviados, omitidos, errores } = data.data;
        if (enviados > 0) {
          toast.success(`Evaluaciones enviadas a ${enviados} candidato${enviados > 1 ? 's' : ''}`);
        }
        if (omitidos > 0) {
          toast.warning(`${omitidos} omitido${omitidos > 1 ? 's' : ''} por errores`);
        }
        if (errores?.length > 0) {
          console.warn('Errores en envio masivo:', errores);
        }
        setOpen(false);
        onSuccess();
      } else {
        toast.error(data.error || 'Error en el envio masivo');
      }
    } catch {
      toast.error('Error en el envio masivo');
    } finally {
      setSending(false);
    }
  }

  const canSubmit = selectedVacante && selectedPlantilla && selectedIds.size > 0 && !sending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <Users className="h-4 w-4" />
          Envio masivo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Envio masivo de evaluaciones</DialogTitle>
          <DialogDescription>
            Selecciona vacante, plantilla y los candidatos a los que deseas enviar la evaluacion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Vacante */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Vacante</label>
            <select
              value={selectedVacante}
              onChange={(e) => setSelectedVacante(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Seleccionar vacante...</option>
              {vacantesLocal.map(v => (
                <option key={v.id} value={v.id}>{v.titulo}</option>
              ))}
            </select>
          </div>

          {/* Plantilla */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Plantilla de evaluacion</label>
            <select
              value={selectedPlantilla}
              onChange={(e) => setSelectedPlantilla(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Seleccionar plantilla...</option>
              {plantillas.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} ({p.duracion_minutos} min)</option>
              ))}
            </select>
          </div>

          {/* Candidatos */}
          {selectedVacante && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Candidatos ({selectedIds.size} de {candidatos.length} seleccionados)
                </label>
                {candidatos.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAll}>
                    {selectedIds.size === candidatos.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </Button>
                )}
              </div>

              {loadingCandidatos ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando candidatos...
                </div>
              ) : candidatos.length === 0 ? (
                <div className="rounded-lg bg-soft-gray p-4 text-sm text-muted-foreground text-center">
                  No hay candidatos elegibles para esta vacante.
                </div>
              ) : (
                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {candidatos.map((c) => {
                    const disabled = c.tiene_eval_activa;
                    return (
                      <label
                        key={c.aplicacion_id}
                        className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                          disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-soft-gray/50 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.aplicacion_id)}
                          onChange={() => !disabled && toggleCandidate(c.aplicacion_id)}
                          disabled={disabled}
                          className="accent-teal h-4 w-4 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.nombre} {c.apellido || ''}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          {c.tiene_eval_activa ? (
                            <Badge className="text-[10px] bg-blue-100 text-blue-700">
                              En curso
                            </Badge>
                          ) : c.eval_previa_estado ? (
                            <div>
                              <Badge className={`text-[10px] ${ESTADO_EVAL_COLORS[c.eval_previa_estado] || 'bg-gray-100 text-gray-600'}`}>
                                {c.eval_previa_estado === 'completada' ? 'Ya presento' :
                                 c.eval_previa_estado === 'expirada' ? 'Expirada' :
                                 c.eval_previa_estado}
                              </Badge>
                              {c.eval_previa_score !== null && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">Score: {c.eval_previa_score}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-green-600 font-medium">Nueva</span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-teal hover:bg-teal/90 gap-1.5"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar a {selectedIds.size} candidato{selectedIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
      const res = await fetch('/api/vacantes?estado=publicada&limit=100');
      const data = await res.json();
      const arr = data.data?.data || data.data || [];
      if (data.success && arr.length > 0) {
        setVacantes(arr);
        setSelectedVacante(arr[0].id);
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
            <div className="flex gap-2">
              <EnvioMasivoDialog onSuccess={fetchEvaluaciones} />
              <Link href="/evaluaciones/nueva">
                <Button className="bg-teal hover:bg-teal/90 gap-1.5">
                  <Plus className="h-4 w-4" />
                  Nueva Evaluación
                </Button>
              </Link>
            </div>
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
