'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { User, Mail, Phone, Linkedin, Briefcase, MapPin, FileText, Trash2, Loader2, CheckCircle2, XCircle, Clock, Upload, FolderOpen, CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { SelectorEstadoAplicacion } from '@/components/candidatos/selector-estado-aplicacion';
import { ScoreBadge } from '@/components/candidatos/score-badge';
import { AgendarEntrevistaModal } from '@/components/entrevistas/agendar-entrevista-modal';
import { Candidato, AplicacionConVacante } from '@/lib/types/candidato.types';
import { getFuenteColor } from '@/lib/utils/design-tokens';
import { toast } from 'sonner';

export default function CandidatoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [candidato, setCandidato] = useState<Candidato | null>(null);
  const [aplicaciones, setAplicaciones] = useState<AplicacionConVacante[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Evaluacion tab state
  const [camposLabels, setCamposLabels] = useState<Record<string, string>>({});
  const [agendarApp, setAgendarApp] = useState<AplicacionConVacante | null>(null);

  // Documentos tab state
  interface DocumentoItem {
    id: string;
    tipo: string;
    label: string;
    descripcion?: string;
    requerido: boolean;
    nombre_archivo: string | null;
    url: string;
    estado: 'pendiente' | 'subido' | 'verificado' | 'rechazado';
    nota_rechazo?: string | null;
    created_at: string;
  }
  interface DocsGroup {
    aplicacionId: string;
    vacanteTitulo: string;
    aplicacionEstado: string;
    documentos: DocumentoItem[];
    completo: boolean;
  }
  const [docsGroups, setDocsGroups] = useState<DocsGroup[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  // Keep legacy for avanzar button
  const [docsAplicacionId, setDocsAplicacionId] = useState<string | null>(null);
  const [rechazarDialogOpen, setRechazarDialogOpen] = useState(false);
  const [rechazarDocId, setRechazarDocId] = useState<string | null>(null);
  const [rechazarMotivo, setRechazarMotivo] = useState('');
  const [verificandoDocId, setVerificandoDocId] = useState<string | null>(null);

  const fetchAplicaciones = useCallback(async () => {
    try {
      const res = await fetch(`/api/candidatos/${params.id}/aplicaciones`);
      const data = await res.json();
      if (data.success) setAplicaciones(data.data || []);
    } catch {
      // silent - aplicaciones tab will show empty
    }
  }, [params.id]);

  const fetchDocumentos = useCallback(async (apps?: AplicacionConVacante[]) => {
    const list = apps || aplicaciones;
    const relevantApps = list.filter(a =>
      ['seleccionado', 'documentos_pendientes', 'documentos_completos', 'contratado', 'onboarding'].includes(a.estado)
    );
    if (relevantApps.length === 0) {
      setDocsGroups([]);
      setDocsAplicacionId(null);
      return;
    }
    setDocsAplicacionId(relevantApps[0].id);
    setDocsLoading(true);
    try {
      const groups: DocsGroup[] = [];
      for (const app of relevantApps) {
        const res = await fetch(`/api/documentos/${app.id}`);
        const data = await res.json();
        if (data.success && data.data) {
          groups.push({
            aplicacionId: app.id,
            vacanteTitulo: app.vacante_titulo || 'Vacante',
            aplicacionEstado: app.estado,
            documentos: data.data.documentos || [],
            completo: data.data.completo || false,
          });
        }
      }
      setDocsGroups(groups);
    } catch {
      // silent
    } finally {
      setDocsLoading(false);
    }
  }, [aplicaciones]);

  useEffect(() => {
    fetchCandidato();
    fetchAplicaciones();
  }, [params.id]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/configuracion/evaluacion-campos');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const map: Record<string, string> = {};
          for (const campo of data.data) {
            if (campo?.campo_key) map[campo.campo_key] = campo.label || campo.campo_key;
          }
          setCamposLabels(map);
        }
      } catch {
        // silent - fallback to raw keys
      }
    })();
  }, []);

  useEffect(() => {
    if (aplicaciones.length > 0) {
      fetchDocumentos(aplicaciones);
    }
  }, [aplicaciones]);

  async function fetchCandidato() {
    try {
      const res = await fetch(`/api/candidatos/${params.id}`);
      const data = await res.json();
      if (data.success) setCandidato(data.data);
    } catch {
      toast.error('Error cargando candidato');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerificarDoc(docId: string) {
    setVerificandoDocId(docId);
    try {
      const res = await fetch(`/api/documentos/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'verificar' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Documento verificado');
        fetchDocumentos();
      } else {
        toast.error(data.error || 'Error verificando documento');
      }
    } catch {
      toast.error('Error verificando documento');
    } finally {
      setVerificandoDocId(null);
    }
  }

  async function handleRechazarDoc() {
    if (!rechazarDocId || !rechazarMotivo.trim()) {
      toast.error('Debe ingresar un motivo de rechazo');
      return;
    }
    setVerificandoDocId(rechazarDocId);
    try {
      const res = await fetch(`/api/documentos/${rechazarDocId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'rechazar', nota_rechazo: rechazarMotivo.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Documento rechazado');
        setRechazarDialogOpen(false);
        setRechazarDocId(null);
        setRechazarMotivo('');
        fetchDocumentos();
      } else {
        toast.error(data.error || 'Error rechazando documento');
      }
    } catch {
      toast.error('Error rechazando documento');
    } finally {
      setVerificandoDocId(null);
    }
  }

  async function handleAvanzarDocumentosCompletos() {
    if (!docsAplicacionId) return;
    try {
      const res = await fetch(`/api/aplicaciones/${docsAplicacionId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'documentos_completos', forzar_auto: true }),
      });
      if (res.ok) {
        toast.success('Estado actualizado a documentos completos');
        fetchAplicaciones();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error actualizando estado');
      }
    } catch {
      toast.error('Error de conexion');
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/candidatos/${params.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Candidato eliminado');
        router.push('/candidatos');
      }
    } catch {
      toast.error('Error eliminando candidato');
    }
  }

  if (loading) return <TableSkeleton />;
  if (!candidato) return <p className="text-center text-muted-foreground py-12">Candidato no encontrado</p>;

  const fuenteColor = getFuenteColor(candidato.fuente);

  return (
    <div className="animate-fade-in">
      <Breadcrumbs overrides={candidato ? { [params.id as string]: `${candidato.nombre} ${candidato.apellido}` } : undefined} />

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-teal/20 to-teal/5 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-teal">
              {(candidato.nombre || '').charAt(0)}{(candidato.apellido || '').charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy">{candidato.nombre} {candidato.apellido}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{candidato.email}</span>
              {candidato.telefono && (
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{candidato.telefono}</span>
              )}
              <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{candidato.experiencia_anos} anos</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fuenteColor.bg} ${fuenteColor.text}`}>
                {fuenteColor.label}
              </span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="text-muted-foreground hover:text-red-500">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue={searchParams.get('tab') || 'perfil'} className="space-y-4">
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="cv">CV Parseado</TabsTrigger>
          <TabsTrigger value="aplicaciones">Aplicaciones</TabsTrigger>
          <TabsTrigger value="evaluacion">Evaluación</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Informacion de contacto</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{candidato.email}</span>
                </div>
                {candidato.telefono && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{candidato.telefono}</span>
                  </div>
                )}
                {candidato.linkedin_url && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <a href={candidato.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                      Ver perfil LinkedIn
                    </a>
                  </div>
                )}
                {candidato.cv_url && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <a href={candidato.cv_url} target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                      Descargar CV / Hoja de vida
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Habilidades</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(candidato.habilidades || []).map((h) => (
                    <span key={h} className="bg-teal/10 text-teal-700 px-2.5 py-1 rounded-full text-xs font-medium">{h}</span>
                  ))}
                  {(!candidato.habilidades || candidato.habilidades.length === 0) && (
                    <p className="text-sm text-muted-foreground">Sin habilidades registradas</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {candidato.salario_esperado && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Salario esperado</p>
                <p className="text-lg font-semibold text-navy">
                  COP {new Intl.NumberFormat('es-CO').format(candidato.salario_esperado)}
                </p>
              </CardContent>
            </Card>
          )}

          {candidato.notas && (
            <Card>
              <CardHeader><CardTitle className="text-base">Notas</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{candidato.notas}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cv">
          <Card>
            <CardContent className="pt-6">
              {candidato.cv_parsed ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Resumen</h3>
                    <p className="text-sm">{(candidato.cv_parsed as any).resumen || (candidato.cv_parsed as any).resumen_profesional || 'Sin resumen'}</p>
                  </div>
                  {candidato.cv_parsed.experiencia?.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Experiencia laboral</h3>
                      {candidato.cv_parsed.experiencia.map((exp, i) => (
                        <div key={i} className="mb-3 pl-3 border-l-2 border-teal">
                          <p className="font-medium text-sm">{exp.cargo}</p>
                          <p className="text-xs text-muted-foreground">{exp.empresa} | {exp.fecha_inicio} - {exp.fecha_fin || 'Actual'}</p>
                          <p className="text-sm mt-1">{exp.descripcion}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {candidato.cv_parsed.educacion?.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Educacion</h3>
                      {candidato.cv_parsed.educacion.map((edu, i) => (
                        <div key={i} className="mb-2">
                          <p className="font-medium text-sm">{edu.titulo}</p>
                          <p className="text-xs text-muted-foreground">{edu.institucion}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">CV no parseado aun</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aplicaciones">
          <Card>
            <CardHeader><CardTitle className="text-base">Historial de aplicaciones</CardTitle></CardHeader>
            <CardContent>
              {aplicaciones.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Sin aplicaciones registradas
                </p>
              ) : (
                <div className="space-y-4">
                  {aplicaciones.map((app) => (
                    <div key={app.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-navy">{app.vacante_titulo}</p>
                          <p className="text-xs text-muted-foreground">{app.vacante_departamento}</p>
                        </div>
                        {app.score_ats !== null && (
                          <Badge variant="outline" className="text-xs">
                            Score ATS: {Number(app.score_ats)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground shrink-0">Estado:</span>
                        <SelectorEstadoAplicacion
                          aplicacionId={app.id}
                          estadoActual={app.estado}
                          estadosCompletados={app.estados_completados || []}
                          candidatoNombre={candidato ? `${candidato.nombre} ${candidato.apellido}` : ''}
                          onEstadoCambiado={fetchAplicaciones}
                          size="md"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Aplicado: {new Date(app.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      {app.estado === 'contrato_terminado' && app.terminacion_motivo && (
                        <div className="mt-1 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm space-y-1">
                          <p className="font-medium text-slate-600 flex items-center gap-1.5">
                            <span>📋</span> Terminacion de contrato
                          </p>
                          <p className="text-slate-500">
                            <span className="font-medium">Motivo:</span>{' '}
                            {({
                              renuncia: 'Renuncia voluntaria',
                              mutuo_acuerdo: 'Terminacion por mutuo acuerdo',
                              justa_causa: 'Terminacion con justa causa',
                              vencimiento: 'Vencimiento de contrato',
                              traslado: 'Traslado / cambio de cargo',
                              otro: 'Otro',
                            } as Record<string, string>)[app.terminacion_motivo] ?? app.terminacion_motivo}
                          </p>
                          {app.terminacion_detalle && (
                            <p className="text-slate-500"><span className="font-medium">Detalle:</span> {app.terminacion_detalle}</p>
                          )}
                          <p className="text-slate-500">
                            <span className="font-medium">Fecha:</span>{' '}
                            {new Date(app.terminacion_fecha!).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                          {app.terminacion_notas && (
                            <p className="text-slate-400 italic text-xs mt-1">Nota interna: {app.terminacion_notas}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evaluacion" className="space-y-4">
          {aplicaciones.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  Este candidato no tiene aplicaciones con evaluación.
                </p>
              </CardContent>
            </Card>
          ) : (
            aplicaciones.map((app) => {
              const scores: { label: string; value: number | null; highlight?: boolean }[] = [
                { label: 'Score ATS', value: app.score_ats },
                { label: 'Score IA', value: app.score_ia },
                { label: 'Prueba técnica', value: app.score_tecnico },
                { label: 'Score Humano', value: app.score_humano },
                { label: 'Score Final (ponderado)', value: app.score_final, highlight: true },
              ];
              const valores = app.evaluacion_humana?.valores;
              return (
                <Card key={app.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{app.vacante_titulo}</CardTitle>
                      <Badge variant="outline" className="text-[10px]">{app.estado.replace(/_/g, ' ')}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <p className="text-sm font-medium text-navy mb-3">Desglose de scores</p>
                      <div className="flex flex-wrap gap-x-8 gap-y-3">
                        {scores.map((s) => (
                          <div key={s.label} className={s.highlight ? 'pl-3 border-l-2 border-teal' : ''}>
                            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                            {s.value !== null && s.value !== undefined ? (
                              <ScoreBadge score={Number(s.value)} size="sm" />
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {valores && Object.keys(valores).length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-navy mb-2">Evaluación humana</p>
                        <div className="space-y-1">
                          {Object.entries(valores).map(([key, valor]) => (
                            <div key={key} className="flex items-center justify-between text-sm border-b last:border-0 py-1">
                              <span className="text-muted-foreground">{camposLabels[key] || key}</span>
                              <span className="font-medium">{valor}</span>
                            </div>
                          ))}
                        </div>
                        {app.evaluacion_humana?.observaciones && (
                          <div className="mt-3 p-3 bg-soft-gray/50 rounded-lg text-sm">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Observaciones</p>
                            <p className="whitespace-pre-wrap">{app.evaluacion_humana.observaciones}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <Button
                        size="sm"
                        onClick={() => setAgendarApp(app)}
                        className="bg-teal hover:bg-teal/90"
                      >
                        <CalendarClock className="h-4 w-4 mr-2" />
                        Agendar entrevista (Meet)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="documentos">
          <Card>
            <CardHeader><CardTitle className="text-base">Documentos del candidato</CardTitle></CardHeader>
            <CardContent>
              {docsLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando documentos...
                </div>
              ) : docsGroups.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground">No hay documentos.</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    El candidato debe ser seleccionado primero para solicitar documentos.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {docsGroups.map((group) => {
                    const requiredDocs = group.documentos.filter(d => d.requerido);
                    const allRequiredVerified = requiredDocs.length === 0
                      ? group.documentos.some(d => d.estado === 'subido' || d.estado === 'verificado')
                      : requiredDocs.every(d => d.estado === 'verificado');
                    const showAvanzar = group.documentos.length > 0 && allRequiredVerified && ['documentos_pendientes', 'seleccionado'].includes(group.aplicacionEstado);
                    return (
                      <div key={group.aplicacionId} className="border rounded-lg overflow-hidden">
                        <div className="bg-soft-gray/50 px-4 py-2.5 flex items-center justify-between border-b">
                          <span className="text-sm font-semibold text-navy">{group.vacanteTitulo}</span>
                          <div className="flex items-center gap-2">
                            {requiredDocs.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {requiredDocs.filter(d => d.estado === 'verificado').length}/{requiredDocs.length} obligatorios verificados
                              </span>
                            )}
                            <Badge variant="outline" className="text-[10px]">{group.aplicacionEstado.replace(/_/g, ' ')}</Badge>
                          </div>
                        </div>
                        {showAvanzar && (
                          <div className="px-4 py-2.5 bg-green-50 border-b border-green-200 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-green-700">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-sm font-medium">Documentos obligatorios verificados</span>
                            </div>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/aplicaciones/${group.aplicacionId}/estado`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ estado: 'documentos_completos', forzar_auto: true }),
                                  });
                                  if (res.ok) {
                                    toast.success('Documentos completos');
                                    fetchAplicaciones();
                                  } else {
                                    const data = await res.json();
                                    toast.error(data.error || 'Error actualizando estado');
                                  }
                                } catch { toast.error('Error de red'); }
                              }}
                            >
                              Avanzar a documentos completos
                            </Button>
                          </div>
                        )}
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-white">
                              <th className="text-left px-4 py-2 font-medium text-xs">Documento</th>
                              <th className="text-center px-4 py-2 font-medium text-xs">Estado</th>
                              <th className="text-center px-4 py-2 font-medium text-xs">Fecha</th>
                              <th className="text-center px-4 py-2 font-medium text-xs">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.documentos.map((doc) => (
                              <tr key={doc.id} className="border-b last:border-0 hover:bg-soft-gray/30 transition-colors">
                                <td className="px-4 py-2.5">
                                  <p className="font-medium text-sm">
                                    {doc.label}
                                    {doc.requerido && <span className="text-orange-500 text-[10px] ml-1" title="Obligatorio">*</span>}
                                  </p>
                                  {doc.nota_rechazo && <p className="text-xs text-red-500 mt-0.5">Motivo: {doc.nota_rechazo}</p>}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {doc.estado === 'pendiente' && <Badge className="bg-gray-100 text-gray-700 text-[10px] gap-1"><Clock className="h-3 w-3" />Pendiente</Badge>}
                                  {doc.estado === 'subido' && <Badge className="bg-blue-100 text-blue-700 text-[10px] gap-1"><Upload className="h-3 w-3" />Subido</Badge>}
                                  {doc.estado === 'verificado' && <Badge className="bg-green-100 text-green-700 text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />Verificado</Badge>}
                                  {doc.estado === 'rechazado' && <Badge className="bg-red-100 text-red-700 text-[10px] gap-1"><XCircle className="h-3 w-3" />Rechazado</Badge>}
                                </td>
                                <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                                  {doc.estado !== 'pendiente' && doc.created_at ? new Date(doc.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1 flex-wrap">
                                    {doc.url && (
                                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                        <Button size="sm" variant="ghost" className="h-7 text-xs text-teal hover:text-teal/80">Ver</Button>
                                      </a>
                                    )}
                                    {doc.estado === 'subido' && (
                                      <>
                                        <Button
                                          size="sm" variant="outline"
                                          className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                                          onClick={() => handleVerificarDoc(doc.id)}
                                          disabled={verificandoDocId === doc.id}
                                        >
                                          {verificandoDocId === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Aprobar'}
                                        </Button>
                                        <Button
                                          size="sm" variant="outline"
                                          className="h-7 text-xs text-red-500 border-red-200 hover:bg-red-50"
                                          onClick={() => {
                                            setRechazarDocId(doc.id);
                                            setRechazarMotivo('');
                                            setRechazarDialogOpen(true);
                                          }}
                                          disabled={verificandoDocId === doc.id}
                                        >
                                          Rechazar
                                        </Button>
                                      </>
                                    )}
                                    {doc.estado === 'verificado' && <span className="text-xs text-green-600 font-medium">Aprobado</span>}
                                    {doc.estado === 'rechazado' && <span className="text-xs text-red-500 font-medium">Rechazado</span>}
                                    {doc.estado === 'pendiente' && <span className="text-xs text-muted-foreground">Esperando</span>}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog for rejecting a document */}
      <Dialog open={rechazarDialogOpen} onOpenChange={setRechazarDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar documento</DialogTitle>
            <DialogDescription>
              Indica el motivo de rechazo. Se notificara al candidato por correo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Motivo del rechazo..."
              value={rechazarMotivo}
              onChange={(e) => setRechazarMotivo(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazarDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRechazarDoc}
              disabled={!rechazarMotivo.trim() || verificandoDocId === rechazarDocId}
            >
              {verificandoDocId === rechazarDocId ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {agendarApp && (
        <AgendarEntrevistaModal
          aplicacionId={agendarApp.id}
          candidatoId={agendarApp.candidato_id}
          vacanteId={agendarApp.vacante_id}
          candidatoNombre={candidato ? `${candidato.nombre} ${candidato.apellido}` : ''}
          open={!!agendarApp}
          onOpenChange={(o) => { if (!o) setAgendarApp(null); }}
          onSuccess={fetchAplicaciones}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar candidato"
        description="Esta accion no se puede deshacer. Se eliminara toda la informacion del candidato."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        destructive
      />
    </div>
  );
}
