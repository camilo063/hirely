'use client';

import { useEffect, useState, useCallback } from 'react';
import { PipelineKanban } from '@/components/candidatos/pipeline-kanban';
import { LinkedInApplicantsAlert } from '@/components/vacantes/linkedin-applicants-alert';
import { ScoreBadge } from '@/components/candidatos/score-badge';
import { ScoreBreakdown } from '@/components/candidatos/score-breakdown';
import { CvParsedView } from '@/components/candidatos/cv-parsed-view';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AplicacionConCandidato } from '@/lib/types/candidato.types';
import { EstadoAplicacion } from '@/lib/types/common.types';
import type { ScoreBreakdown as ScoreBreakdownType } from '@/lib/types/scoring.types';
import { toast } from 'sonner';
import { EntrevistaIATrigger } from '@/components/entrevistas/entrevista-ia-trigger';
import { SeleccionarCandidatoBtn } from '@/components/seleccion/seleccionar-candidato-btn';
import { RechazarCandidatosBtn } from '@/components/seleccion/rechazar-candidatos-btn';
import { DocumentosChecklist } from '@/components/seleccion/documentos-checklist';
import { ContratarBtn } from '@/components/onboarding/contratar-btn';
import { OnboardingStatusPanel } from '@/components/onboarding/onboarding-status-panel';
import { GenerarContratoForm } from '@/components/contratos/generar-contrato-form';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Zap, LayoutGrid, TableIcon, Filter, RefreshCw, Check, X,
  Loader2, Mail, Phone, MapPin, Linkedin, FileCheck, Users, UserCheck, FileText,
  MoreHorizontal, Eye, ArrowRight, ArrowLeft, XCircle, Brain, CheckCircle, Award,
  AlertTriangle, ChevronDown,
} from 'lucide-react';
import { SelectorEstadoAplicacion } from '@/components/candidatos/selector-estado-aplicacion';
import type { EvaluacionTecnicaResumen } from '@/lib/types/candidato.types';

function PruebaTecnicaBadge({ evaluacion }: { evaluacion: EvaluacionTecnicaResumen | null }) {
  if (!evaluacion) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const score = evaluacion.score_total !== null ? Number(evaluacion.score_total).toFixed(0) : null;
  const base = 'text-xs gap-1 whitespace-nowrap';
  switch (evaluacion.estado) {
    case 'pendiente':
      return (
        <Badge variant="outline" className={`${base} text-slate-600 border-slate-300`}>
          <FileText className="h-3 w-3" /> Pendiente
        </Badge>
      );
    case 'enviada':
      return (
        <Badge variant="outline" className={`${base} text-blue-600 border-blue-300 bg-blue-50`}>
          <Mail className="h-3 w-3" /> Enviada
        </Badge>
      );
    case 'en_progreso':
      return (
        <Badge variant="outline" className={`${base} text-amber-700 border-amber-300 bg-amber-50`}>
          <Loader2 className="h-3 w-3" /> En progreso
        </Badge>
      );
    case 'completada':
      return (
        <Badge
          variant="outline"
          className={`${base} ${evaluacion.aprobada === false ? 'text-red-600 border-red-300 bg-red-50' : 'text-success border-success/30 bg-success/5'}`}
        >
          <CheckCircle className="h-3 w-3" /> Completada{score !== null ? ` · ${score}` : ''}
        </Badge>
      );
    case 'expirada':
      return (
        <Badge variant="outline" className={`${base} text-red-600 border-red-300 bg-red-50`}>
          <XCircle className="h-3 w-3" /> Expirada
        </Badge>
      );
    case 'cancelada':
      return (
        <Badge variant="outline" className={`${base} text-muted-foreground border-slate-200`}>
          <XCircle className="h-3 w-3" /> Cancelada
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={`${base} text-slate-600 border-slate-300`}>
          {evaluacion.estado}
        </Badge>
      );
  }
}

interface PipelineCompletoProps {
  vacanteId: string;
  vacanteTitulo: string;
  scoreMinimo: number;
  linkedinJobId: string | null;
}

export function PipelineCompleto({
  vacanteId,
  vacanteTitulo,
  scoreMinimo,
  linkedinJobId,
}: PipelineCompletoProps) {
  const [aplicaciones, setAplicaciones] = useState<AplicacionConCandidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoringLoading, setScoringLoading] = useState(false);
  const [rescoringId, setRescoringId] = useState<string | null>(null);
  const [filterPasaCorte, setFilterPasaCorte] = useState(false);
  const [selectedAplicacion, setSelectedAplicacion] = useState<AplicacionConCandidato | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/vacantes/${vacanteId}/candidatos`);
      const data = await res.json();
      if (data.success) setAplicaciones(data.data || []);
    } catch {
      toast.error('Error cargando pipeline');
    } finally {
      setLoading(false);
    }
  }, [vacanteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleMoveAplicacion(aplicacionId: string, nuevoEstado: EstadoAplicacion) {
    try {
      setAplicaciones((prev) =>
        prev.map((a) => (a.id === aplicacionId ? { ...a, estado: nuevoEstado } : a))
      );
      const res = await fetch(`/api/aplicaciones/${aplicacionId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!res.ok) {
        fetchData();
        toast.error('Error moviendo candidato');
      }
    } catch {
      fetchData();
      toast.error('Error moviendo candidato');
    }
  }

  async function handleBulkScoring(opts: { force?: boolean } = {}) {
    const force = !!opts.force;
    const pendientesCount = aplicaciones.filter(
      (a) =>
        a.score_ats === null ||
        (a as any).score_ats_error ||
        (a.candidato?.cv_url && isCvFallback(a.candidato?.cv_parsed)),
    ).length;
    const totalCount = aplicaciones.length;

    const objetivo = force ? totalCount : pendientesCount;
    if (objetivo === 0) {
      toast.info('No hay candidatos pendientes de calificar');
      return;
    }

    const mensaje = force
      ? `Recalcular el score de los ${totalCount} candidatos? Esto puede tomar unos minutos.`
      : `Calificar ${pendientesCount} candidato(s) pendientes? Esto puede tomar unos minutos.`;
    if (typeof window !== 'undefined' && !window.confirm(mensaje)) return;

    setScoringLoading(true);
    try {
      const res = await fetch('/api/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'ats_pipeline', vacante_id: vacanteId, force }),
      });
      const data = await res.json();
      if (data.success) {
        const result = data.data;
        if (result.total === 0) {
          toast.info('No hay candidatos para calificar');
        } else if (result.exitosos === result.total) {
          toast.success('Scoring completado', {
            description: `${result.total} candidato(s) evaluados correctamente`,
          });
        } else if (result.exitosos > 0) {
          toast.warning('Scoring parcial', {
            description: `${result.exitosos}/${result.total} candidatos evaluados. ${result.errores} con error.`,
          });
        } else {
          toast.error('Error en scoring', {
            description: 'No se pudo evaluar ningun candidato. Verifique que los candidatos tengan CV o datos de LinkedIn.',
          });
        }
        await fetchData();
      } else {
        toast.error(data.error || 'Error al ejecutar scoring');
      }
    } catch {
      toast.error('Error de conexion al ejecutar scoring');
    } finally {
      setScoringLoading(false);
    }
  }

  async function handleRescore(candidatoId: string) {
    setRescoringId(candidatoId);
    try {
      const res = await fetch(`/api/candidatos/${candidatoId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacante_id: vacanteId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Score recalculado: ${data.data.score_total}/100`);
        await fetchData();
        if (selectedAplicacion?.candidato_id === candidatoId) {
          const updated = aplicaciones.find(a => a.candidato_id === candidatoId);
          if (updated) setSelectedAplicacion(updated);
        }
      } else {
        toast.error(data.error || 'Error al recalcular score');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setRescoringId(null);
    }
  }

  const filteredAplicaciones = filterPasaCorte
    ? aplicaciones.filter(a => a.score_ats !== null && Number(a.score_ats) >= scoreMinimo)
    : aplicaciones;

  const pasanCorte = aplicaciones.filter(a => a.score_ats !== null && Number(a.score_ats) >= scoreMinimo).length;
  const conScore = aplicaciones.filter(a => a.score_ats !== null).length;
  const estimadosScore = aplicaciones.filter(
    (a) => a.score_ats !== null && a.candidato?.cv_url && isCvFallback(a.candidato?.cv_parsed),
  ).length;
  const evaluadosScore = conScore - estimadosScore;
  const pendientesScore = aplicaciones.filter(
    (a) =>
      a.score_ats === null ||
      (a as any).score_ats_error ||
      (a.candidato?.cv_url && isCvFallback(a.candidato?.cv_parsed)),
  ).length;

  if (loading) return <TableSkeleton />;

  return (
    <div>
      {/* Header bar */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {aplicaciones.length} candidato(s) &middot; {evaluadosScore} evaluados
          {estimadosScore > 0 && (
            <> &middot; <span className="text-amber-600 font-medium">{estimadosScore} estimados</span></>
          )}
          {(pendientesScore - estimadosScore) > 0 && (
            <> &middot; <span className="text-orange font-medium">{pendientesScore - estimadosScore} pendientes</span></>
          )}
        </p>
        <div className="flex items-center gap-2">
          {pendientesScore > 0 ? (
            <div className="flex">
              <Button
                size="sm"
                onClick={() => handleBulkScoring({ force: false })}
                disabled={scoringLoading}
                className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white rounded-r-none"
              >
                {scoringLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-1" />
                )}
                {estimadosScore > 0 && (pendientesScore - estimadosScore) === 0
                  ? `Recalificar con CV (${estimadosScore})`
                  : `Calificar pendientes (${pendientesScore})`}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    disabled={scoringLoading}
                    className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white rounded-l-none border-l border-white/30 px-2"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => handleBulkScoring({ force: true })}>
                    <RefreshCw className="h-3.5 w-3.5 mr-2" /> Recalcular todos ({aplicaciones.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkScoring({ force: true })}
              disabled={scoringLoading || aplicaciones.length === 0}
            >
              {scoringLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Recalcular scores
            </Button>
          )}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('table')}
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk reject button */}
      {aplicaciones.some(a => a.estado === 'seleccionado') && (
        <div className="mb-4">
          <RechazarCandidatosBtn
            aplicacionIds={aplicaciones
              .filter(a => a.estado !== 'seleccionado' && a.estado !== 'descartado' && a.estado !== 'contratado')
              .map(a => a.id)
            }
            count={aplicaciones.filter(a => a.estado !== 'seleccionado' && a.estado !== 'descartado' && a.estado !== 'contratado').length}
            vacanteTitulo={vacanteTitulo}
            onSuccess={fetchData}
          />
        </div>
      )}

      <LinkedInApplicantsAlert
        vacanteId={vacanteId}
        isPublishedOnLinkedIn={!!linkedinJobId}
      />

      {viewMode === 'kanban' ? (
        <PipelineKanban
          aplicaciones={filteredAplicaciones}
          onMoveAplicacion={handleMoveAplicacion}
          onClickAplicacion={setSelectedAplicacion}
        />
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setFilterPasaCorte(!filterPasaCorte)}
              className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
                filterPasaCorte
                  ? 'bg-teal/10 text-teal border-teal/30'
                  : 'bg-white text-muted-foreground border-gray-200 hover:border-gray-300'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              Solo candidatos que pasan corte
            </button>
            <span className="text-sm text-muted-foreground">
              {pasanCorte} de {aplicaciones.length} pasan el corte (&ge;{scoreMinimo})
            </span>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidato</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead className="text-center">Score ATS</TableHead>
                  <TableHead className="text-center">Corte</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prueba Técnica</TableHead>
                  <TableHead>Habilidades</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAplicaciones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {filterPasaCorte ? 'Ningun candidato pasa el corte' : 'Sin candidatos en esta vacante'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAplicaciones.map((app) => (
                    <TableRow
                      key={app.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedAplicacion(app)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm text-navy">
                            {app.candidato.nombre} {app.candidato.apellido}
                          </p>
                          <p className="text-xs text-muted-foreground">{app.candidato.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {app.candidato.fuente === 'linkedin' ? (
                          <Badge variant="outline" className="text-xs gap-1 text-[#0A66C2] border-[#0A66C2]/30">
                            <Linkedin className="h-3 w-3" /> LinkedIn
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{app.candidato.fuente}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                          <ScoreCellInline
                            aplicacion={app}
                            rescoringId={rescoringId}
                            onRescore={() => handleRescore(app.candidato_id)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {app.score_ats !== null && (() => {
                          const fb = app.candidato?.cv_url && isCvFallback(app.candidato?.cv_parsed);
                          const pasa = Number(app.score_ats) >= scoreMinimo;
                          if (fb) {
                            return (
                              <Badge
                                variant="outline"
                                className="text-xs text-amber-700 border-amber-300 bg-amber-50 gap-1"
                                title="Score estimado sin CV — recalifica para confirmar"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {pasa ? 'Pasa (estimado)' : 'No pasa (estimado)'}
                              </Badge>
                            );
                          }
                          return pasa ? (
                            <Badge variant="outline" className="text-xs text-success border-success/30 gap-1">
                              <Check className="h-3 w-3" /> Pasa
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-red-500 border-red-200 gap-1">
                              <X className="h-3 w-3" /> No pasa
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <SelectorEstadoAplicacion
                          aplicacionId={app.id}
                          estadoActual={app.estado}
                          estadosCompletados={app.estados_completados || []}
                          candidatoNombre={`${app.candidato.nombre} ${app.candidato.apellido}`}
                          onEstadoCambiado={fetchData}
                          size="sm"
                          vacanteTitulo={vacanteTitulo}
                          fechaInicioTentativa={(app as { fecha_inicio_tentativa?: string }).fecha_inicio_tentativa}
                        />
                      </TableCell>
                      <TableCell>
                        <PruebaTecnicaBadge evaluacion={app.evaluacion_tecnica} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(app.candidato.habilidades as string[] || []).slice(0, 3).map((h) => (
                            <span key={h} className="text-[10px] bg-soft-gray px-1.5 py-0.5 rounded">{h}</span>
                          ))}
                          {(app.candidato.habilidades as string[] || []).length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{(app.candidato.habilidades as string[]).length - 3}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedAplicacion(app); }}>
                              <Eye className="h-3.5 w-3.5 mr-2" /> Ver perfil
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRescore(app.candidato_id); }}>
                              <RefreshCw className="h-3.5 w-3.5 mr-2" /> Recalcular score
                            </DropdownMenuItem>

                            {app.estado === EstadoAplicacion.NUEVO && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveAplicacion(app.id, EstadoAplicacion.REVISADO); }}>
                                  <ArrowRight className="h-3.5 w-3.5 mr-2" /> Avanzar a revision
                                </DropdownMenuItem>
                              </>
                            )}

                            {app.estado === EstadoAplicacion.REVISADO && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveAplicacion(app.id, EstadoAplicacion.PRESELECCIONADO); }}>
                                  <CheckCircle className="h-3.5 w-3.5 mr-2" /> Preseleccionar
                                </DropdownMenuItem>
                              </>
                            )}

                            {app.estado === EstadoAplicacion.PRESELECCIONADO && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedAplicacion(app); }}>
                                  <Brain className="h-3.5 w-3.5 mr-2" /> Iniciar entrevista IA
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveAplicacion(app.id, EstadoAplicacion.ENTREVISTA_HUMANA); }}>
                                  <ArrowRight className="h-3.5 w-3.5 mr-2" /> Saltar a entrevista humana
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveAplicacion(app.id, EstadoAplicacion.REVISADO); }}>
                                  <ArrowLeft className="h-3.5 w-3.5 mr-2" /> Devolver a revision
                                </DropdownMenuItem>
                              </>
                            )}

                            {app.estado === EstadoAplicacion.ENTREVISTA_IA && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveAplicacion(app.id, EstadoAplicacion.ENTREVISTA_HUMANA); }}>
                                  <ArrowRight className="h-3.5 w-3.5 mr-2" /> Avanzar a entrevista humana
                                </DropdownMenuItem>
                              </>
                            )}

                            {(app.estado === EstadoAplicacion.ENTREVISTA_HUMANA || app.estado === EstadoAplicacion.EVALUADO) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedAplicacion(app); }}>
                                  <Award className="h-3.5 w-3.5 mr-2" /> Seleccionar candidato
                                </DropdownMenuItem>
                              </>
                            )}

                            {app.estado === EstadoAplicacion.SELECCIONADO && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedAplicacion(app); }}>
                                  <UserCheck className="h-3.5 w-3.5 mr-2" /> Contratar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveAplicacion(app.id, EstadoAplicacion.ENTREVISTA_HUMANA); }}>
                                  <ArrowLeft className="h-3.5 w-3.5 mr-2" /> Regresar a entrevista
                                </DropdownMenuItem>
                              </>
                            )}

                            {app.estado === EstadoAplicacion.DESCARTADO && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveAplicacion(app.id, EstadoAplicacion.NUEVO); }}>
                                  <RefreshCw className="h-3.5 w-3.5 mr-2" /> Reactivar candidato
                                </DropdownMenuItem>
                              </>
                            )}

                            {app.estado !== EstadoAplicacion.DESCARTADO && app.estado !== EstadoAplicacion.CONTRATADO && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); handleMoveAplicacion(app.id, EstadoAplicacion.DESCARTADO); }}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-2" /> Descartar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Side panel */}
      <Sheet open={!!selectedAplicacion} onOpenChange={(open) => { if (!open) setSelectedAplicacion(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedAplicacion && (
            <CandidatoDetailPanel
              aplicacion={selectedAplicacion}
              scoreMinimo={scoreMinimo}
              rescoringId={rescoringId}
              onRescore={() => handleRescore(selectedAplicacion.candidato_id)}
              vacanteTitulo={vacanteTitulo}
              onRefresh={fetchData}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CandidatoDetailPanel({
  aplicacion,
  scoreMinimo,
  rescoringId,
  onRescore,
  vacanteTitulo,
  onRefresh,
}: {
  aplicacion: AplicacionConCandidato;
  scoreMinimo: number;
  rescoringId: string | null;
  onRescore: () => void;
  vacanteTitulo: string;
  onRefresh: () => void;
}) {
  const candidato = aplicacion.candidato;
  const score = aplicacion.score_ats !== null ? Number(aplicacion.score_ats) : null;
  const breakdown = aplicacion.score_ats_breakdown as ScoreBreakdownType | null;

  const recomendacion = score !== null
    ? score >= 85 ? 'Alta' : score >= 70 ? 'Media' : score >= 50 ? 'Baja' : 'No apto'
    : null;

  const recomendacionColor = score !== null
    ? score >= 85 ? 'text-success' : score >= 70 ? 'text-teal' : score >= 50 ? 'text-orange' : 'text-red-500'
    : '';

  return (
    <div className="space-y-6 pt-4">
      <SheetHeader>
        <SheetTitle className="text-lg">
          {candidato.nombre} {candidato.apellido}
        </SheetTitle>
      </SheetHeader>

      {/* Contact info */}
      <div className="space-y-1.5 text-sm">
        {candidato.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> {candidato.email}
          </div>
        )}
        {candidato.telefono && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" /> {candidato.telefono}
          </div>
        )}
        {candidato.ubicacion && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {candidato.ubicacion}
          </div>
        )}
        {candidato.linkedin_url && (
          <a
            href={candidato.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[#0A66C2] hover:underline"
          >
            <Linkedin className="h-3.5 w-3.5" /> LinkedIn
          </a>
        )}
      </div>

      {/* Score summary */}
      <div className="bg-soft-gray rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <ScoreBadge score={score} size="lg" />
            {recomendacion && (
              <div>
                <p className={`text-sm font-bold ${recomendacionColor}`}>{recomendacion}</p>
                <p className="text-xs text-muted-foreground">
                  {score !== null && score >= scoreMinimo ? 'Pasa el corte' : 'No pasa el corte'}
                  {` (min: ${scoreMinimo})`}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRescore}
            disabled={rescoringId === candidato.id}
          >
            {rescoringId === candidato.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
            )}
            Recalcular
          </Button>
        </div>
        {aplicacion.score_ats_resumen && (
          <p className="text-xs text-muted-foreground mt-2">{aplicacion.score_ats_resumen}</p>
        )}
      </div>

      {/* Entrevista IA button */}
      {score !== null && score >= scoreMinimo && aplicacion.estado !== 'seleccionado' && aplicacion.estado !== 'contratado' && (
        <EntrevistaIATrigger
          aplicacionId={aplicacion.id}
          candidatoNombre={`${candidato.nombre} ${candidato.apellido}`}
          candidatoTelefono={candidato.telefono || null}
          vacanteTitulo={vacanteTitulo}
          onSuccess={onRefresh}
        />
      )}

      {/* Selection buttons */}
      {['entrevista_humana', 'evaluado'].includes(aplicacion.estado) && (
        <div className="flex items-center gap-2">
          <SeleccionarCandidatoBtn
            aplicacionId={aplicacion.id}
            candidatoNombre={`${candidato.nombre} ${candidato.apellido}`}
            vacanteTitulo={vacanteTitulo}
            scoreAts={aplicacion.score_ats}
            scoreIa={aplicacion.score_ia}
            scoreHumano={aplicacion.score_humano}
            scoreFinal={aplicacion.score_final}
            vacanteId={aplicacion.vacante_id}
            onSuccess={onRefresh}
          />
          <RechazarCandidatosBtn
            aplicacionId={aplicacion.id}
            candidatoNombre={`${candidato.nombre} ${candidato.apellido}`}
            onSuccess={onRefresh}
          />
        </div>
      )}

      {/* Contratar button */}
      {aplicacion.estado === 'seleccionado' && (
        <ContratarBtn
          aplicacionId={aplicacion.id}
          candidatoNombre={`${candidato.nombre} ${candidato.apellido}`}
          vacanteTitulo={vacanteTitulo}
          fechaInicioTentativa={(aplicacion as any).fecha_inicio_tentativa}
          documentosCompletos={!!(aplicacion as any).documentos_completos}
          onSuccess={onRefresh}
        />
      )}

      {/* Tabs: Breakdown / CV / Documentos / Onboarding */}
      <Tabs defaultValue={
        aplicacion.estado === 'contratado' ? 'onboarding' :
        aplicacion.estado === 'seleccionado' ? 'documentos' : 'breakdown'
      }>
        <TabsList className="w-full">
          <TabsTrigger value="breakdown" className="flex-1">Score</TabsTrigger>
          <TabsTrigger value="cv" className="flex-1">CV</TabsTrigger>
          {aplicacion.estado === 'seleccionado' && (
            <TabsTrigger value="documentos" className="flex-1 gap-1">
              <FileCheck className="h-3 w-3" /> Docs
            </TabsTrigger>
          )}
          {aplicacion.estado === 'contratado' && (
            <TabsTrigger value="onboarding" className="flex-1 gap-1">
              <UserCheck className="h-3 w-3" /> Onboarding
            </TabsTrigger>
          )}
          {aplicacion.estado === 'contratado' && (
            <TabsTrigger value="contrato" className="flex-1 gap-1">
              <FileText className="h-3 w-3" /> Contrato
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="breakdown" className="mt-4">
          {breakdown ? (
            <ScoreBreakdown breakdown={breakdown} scoreTotal={score || 0} />
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <p>Sin desglose disponible.</p>
              <p className="text-xs mt-1">Ejecute el scoring para ver el detalle.</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="cv" className="mt-4">
          <CvParsedView
            cvParsed={candidato.cv_parsed as any}
            cvUrl={candidato.cv_url}
            compact
            onAnalizarConIA={onRescore}
            analizando={rescoringId === candidato.id}
          />
        </TabsContent>
        {aplicacion.estado === 'seleccionado' && (
          <TabsContent value="documentos" className="mt-4">
            <DocumentosChecklist
              aplicacionId={aplicacion.id}
              portalToken={(aplicacion as any).portal_token}
            />
          </TabsContent>
        )}
        {aplicacion.estado === 'contratado' && (
          <TabsContent value="onboarding" className="mt-4">
            <OnboardingTabContent aplicacionId={aplicacion.id} />
          </TabsContent>
        )}
        {aplicacion.estado === 'contratado' && (
          <TabsContent value="contrato" className="mt-4">
            <ContratoTabContent
              aplicacionId={aplicacion.id}
              candidatoId={candidato.id}
              vacanteId={aplicacion.vacante_id}
              candidatoNombre={`${candidato.nombre} ${candidato.apellido || ''}`}
              vacanteTitulo={vacanteTitulo}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function OnboardingTabContent({ aplicacionId }: { aplicacionId: string }) {
  const [onboarding, setOnboarding] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchOnboarding = useCallback(async () => {
    try {
      const res = await fetch(`/api/onboarding?aplicacion_id=${aplicacionId}`);
      if (res.ok) {
        const { data } = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setOnboarding(data[0]);
        }
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [aplicacionId]);

  useEffect(() => { fetchOnboarding(); }, [fetchOnboarding]);

  if (loading) return <div className="flex items-center justify-center py-6 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando...</div>;
  if (!onboarding) return <div className="text-center py-6 text-muted-foreground text-sm">Sin datos de onboarding</div>;

  return <OnboardingStatusPanel onboarding={onboarding} onUpdate={fetchOnboarding} />;
}

function ContratoTabContent({
  aplicacionId, candidatoId, vacanteId, candidatoNombre, vacanteTitulo,
}: {
  aplicacionId: string; candidatoId: string; vacanteId: string;
  candidatoNombre: string; vacanteTitulo: string;
}) {
  const [contrato, setContrato] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchContrato = useCallback(async () => {
    try {
      const res = await fetch(`/api/contratos?search=${encodeURIComponent(candidatoNombre.split(' ')[0])}`);
      if (res.ok) {
        const { data } = await res.json();
        const found = (data || []).find((c: any) => c.aplicacion_id === aplicacionId);
        if (found) setContrato(found);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [aplicacionId, candidatoNombre]);

  useEffect(() => { fetchContrato(); }, [fetchContrato]);

  if (loading) return <div className="flex items-center justify-center py-6 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando...</div>;

  if (contrato) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="capitalize">{contrato.estado}</Badge>
          <a href={`/contratos/${contrato.id}`} className="text-sm text-teal hover:underline">
            Ver contrato completo
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          Tipo: {contrato.tipo} | Versión: {contrato.version || 1}
        </p>
      </div>
    );
  }

  if (showForm) {
    return (
      <GenerarContratoForm
        aplicacionId={aplicacionId}
        candidatoId={candidatoId}
        vacanteId={vacanteId}
        candidatoNombre={candidatoNombre}
        vacanteTitulo={vacanteTitulo}
        onSuccess={(id) => { setContrato({ id, estado: 'borrador' }); setShowForm(false); }}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  return (
    <div className="text-center py-6">
      <p className="text-sm text-muted-foreground mb-3">No hay contrato generado para este candidato</p>
      <Button size="sm" onClick={() => setShowForm(true)} className="bg-teal hover:bg-teal/90 text-white">
        <FileText className="h-4 w-4 mr-1" /> Generar contrato
      </Button>
    </div>
  );
}

/**
 * Celda inline que muestra el ScoreBadge cuando hay score, o un boton
 * "Calificar con IA" cuando falta el score o hubo un error.
 * Si se acaba de crear la aplicacion (< 2 min), muestra "Pendiente..." en
 * vez del boton para evitar interferir con el scoring async en curso.
 */
/**
 * Devuelve true si el cv_parsed del candidato proviene del fallback
 * (sin pasar por Claude/IA) o tiene baja confianza, o si no esta parseado.
 */
function isCvFallback(cvParsed: any): boolean {
  if (!cvParsed || !cvParsed.parsed_at) return false; // sin parsear aun: NO es fallback, solo "sin score"
  if (cvParsed.parser_version === '1.0-fallback') return true;
  if (cvParsed.parser_version === '1.0-minimal') return true;
  if (typeof cvParsed.confianza === 'number' && cvParsed.confianza < 0.5) return true;
  return false;
}

function ScoreCellInline({
  aplicacion,
  rescoringId,
  onRescore,
}: {
  aplicacion: AplicacionConCandidato;
  rescoringId: string | null;
  onRescore: () => void;
}) {
  const score = aplicacion.score_ats !== null ? Number(aplicacion.score_ats) : null;
  const error = (aplicacion as any).score_ats_error as string | null | undefined;
  const isLoading = rescoringId === aplicacion.candidato_id;
  const fallback = isCvFallback(aplicacion.candidato?.cv_parsed);
  const tieneCv = !!aplicacion.candidato?.cv_url;

  // Score existe pero es estimado (fallback) y hay PDF disponible: ofrecer recalificar
  if (score !== null && fallback && tieneCv) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <ScoreBadge score={score} size="sm" />
        <span title="Score estimado sin CV. Califica con IA para obtener un score preciso.">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={onRescore}
          disabled={isLoading}
          className="h-6 px-2 text-[11px] border-amber-400 text-amber-700 hover:bg-amber-50"
          title="Recalificar usando el CV real"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          Recalificar
        </Button>
      </div>
    );
  }

  // Score existe y es confiable
  if (score !== null) {
    return <ScoreBadge score={score} size="sm" />;
  }

  // Sin score: detectar si fue creada hace poco (esperando scoring async)
  const createdAt = aplicacion.created_at ? new Date(aplicacion.created_at) : null;
  const ageMs = createdAt ? Date.now() - createdAt.getTime() : Infinity;
  const recienCreada = ageMs < 2 * 60 * 1000; // 2 minutos

  if (recienCreada && !error) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-soft-gray px-2 py-1 rounded-full">
        <Loader2 className="h-3 w-3 animate-spin" /> Calificando...
      </span>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onRescore}
      disabled={isLoading}
      className="h-7 px-2 text-xs border-[#FF6B35]/40 text-[#FF6B35] hover:bg-[#FF6B35]/10 hover:text-[#FF6B35]"
      title={error ? `Error previo: ${error}` : 'Calificar candidato con IA'}
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      ) : error ? (
        <AlertTriangle className="h-3 w-3 mr-1" />
      ) : (
        <Zap className="h-3 w-3 mr-1" />
      )}
      Calificar con IA
    </Button>
  );
}
