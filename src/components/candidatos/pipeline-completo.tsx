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
} from 'lucide-react';

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
      const res = await fetch(`/api/candidatos/${aplicacionId}`, {
        method: 'PUT',
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

  async function handleBulkScoring() {
    setScoringLoading(true);
    try {
      const res = await fetch('/api/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'ats_pipeline', vacante_id: vacanteId }),
      });
      const data = await res.json();
      if (data.success) {
        const result = data.data;
        if (result.exitosos === result.total) {
          toast.success('Scoring completado', {
            description: `${result.total} candidatos evaluados correctamente`,
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

  if (loading) return <TableSkeleton />;

  return (
    <div>
      {/* Header bar */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {aplicaciones.length} candidato(s) &middot; {conScore} evaluados
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkScoring}
            disabled={scoringLoading}
          >
            {scoringLoading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-1" />
            )}
            {conScore > 0 ? 'Recalcular Scores' : 'Calcular Scores'}
          </Button>
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
                  <TableHead>Habilidades</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAplicaciones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
                        <div className="flex justify-center">
                          <ScoreBadge score={app.score_ats !== null ? Number(app.score_ats) : null} size="sm" />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {app.score_ats !== null && (
                          Number(app.score_ats) >= scoreMinimo ? (
                            <Badge variant="outline" className="text-xs text-success border-success/30 gap-1">
                              <Check className="h-3 w-3" /> Pasa
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-red-500 border-red-200 gap-1">
                              <X className="h-3 w-3" /> No pasa
                            </Badge>
                          )
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {app.estado.replace(/_/g, ' ')}
                        </Badge>
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
          <CvParsedView cvParsed={candidato.cv_parsed as any} compact />
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
