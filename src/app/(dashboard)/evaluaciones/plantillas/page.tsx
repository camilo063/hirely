'use client';

import { useEffect, useState } from 'react';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { toast } from 'sonner';
import {
  Plus, FileText, Archive, Trash2, Info, Eye, RefreshCw,
  CheckCircle2, Circle, Clock, Hash, Award,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { EvaluacionPlantilla, EstructuraPlantilla, CategoriaConteo } from '@/lib/types/evaluacion-tecnica.types';

const DIFICULTAD_COLORS: Record<string, string> = {
  basico: 'bg-green-100 text-green-700',
  intermedio: 'bg-blue-100 text-blue-700',
  avanzado: 'bg-orange-100 text-orange-700',
  experto: 'bg-red-100 text-red-700',
  mixta: 'bg-purple-100 text-purple-700',
};

const TIPO_LABELS: Record<string, string> = {
  opcion_multiple: 'Opción múltiple',
  verdadero_falso: 'Verdadero / Falso',
  respuesta_abierta: 'Respuesta abierta',
  codigo: 'Código',
};

interface PreguntaPreview {
  pregunta_id: string;
  enunciado: string;
  tipo: string;
  opciones: Array<{ id: string; texto: string; es_correcta: boolean }> | null;
  respuesta_correcta: string | null;
  explicacion: string | null;
  puntos: number;
  orden: number;
  categoria: string;
  dificultad: string;
  tiempo_estimado_segundos: number;
}

export default function PlantillasPage() {
  const [plantillas, setPlantillas] = useState<EvaluacionPlantilla[]>([]);
  const [categorias, setCategorias] = useState<CategoriaConteo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<EvaluacionPlantilla | null>(null);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<EvaluacionPlantilla | null>(null);
  const [previewPreguntas, setPreviewPreguntas] = useState<PreguntaPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Form state
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [duracion, setDuracion] = useState(60);
  const [puntajeAprobatorio, setPuntajeAprobatorio] = useState(70);
  const [estructura, setEstructura] = useState<EstructuraPlantilla[]>([
    { categoria: '', cantidad: 5, dificultad: 'intermedio', puntos_por_pregunta: 10 },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPlantillas();
    fetchCategorias();
  }, []);

  async function fetchPlantillas() {
    setLoading(true);
    try {
      const res = await fetch('/api/evaluaciones/plantillas');
      const data = await res.json();
      if (data.success) setPlantillas(data.data || []);
    } catch {
      toast.error('Error cargando plantillas');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategorias() {
    try {
      const res = await fetch('/api/evaluaciones/banco-preguntas/categorias');
      const data = await res.json();
      if (data.success) setCategorias(data.data || []);
    } catch { /* ignore */ }
  }

  async function loadPreview(plantilla: EvaluacionPlantilla) {
    const est: EstructuraPlantilla[] = typeof plantilla.estructura === 'string'
      ? JSON.parse(plantilla.estructura)
      : plantilla.estructura;

    setPreviewLoading(true);
    setPreviewPreguntas([]);
    try {
      const res = await fetch('/api/evaluaciones/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estructura: est.filter(e => e.categoria) }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewPreguntas(data.data.preguntas);
      } else {
        toast.error(data.error || 'Error cargando preview');
      }
    } catch {
      toast.error('Error de red');
    } finally {
      setPreviewLoading(false);
    }
  }

  function handlePreview(e: React.MouseEvent, p: EvaluacionPlantilla) {
    e.stopPropagation();
    setPreviewTarget(p);
    setPreviewOpen(true);
    loadPreview(p);
  }

  function handleNew() {
    setEditing(null);
    setNombre('');
    setDescripcion('');
    setDuracion(60);
    setPuntajeAprobatorio(70);
    setEstructura([{ categoria: '', cantidad: 5, dificultad: 'intermedio', puntos_por_pregunta: 10 }]);
    setSheetOpen(true);
  }

  function handleEdit(p: EvaluacionPlantilla) {
    setEditing(p);
    setNombre(p.nombre);
    setDescripcion(p.descripcion || '');
    setDuracion(p.duracion_minutos);
    setPuntajeAprobatorio(p.puntaje_aprobatorio);
    const est = typeof p.estructura === 'string' ? JSON.parse(p.estructura) : p.estructura;
    setEstructura(est.length > 0 ? est : [{ categoria: '', cantidad: 5, dificultad: 'intermedio', puntos_por_pregunta: 10 }]);
    setSheetOpen(true);
  }

  function updateEstructura(index: number, field: keyof EstructuraPlantilla, value: string | number) {
    const updated = [...estructura];
    (updated[index] as any)[field] = value;
    setEstructura(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const puntajeTotal = estructura.reduce((s, e) => s + e.cantidad * e.puntos_por_pregunta, 0);

    const data = {
      nombre, descripcion: descripcion || null, duracion_minutos: duracion,
      puntaje_total: puntajeTotal, puntaje_aprobatorio: puntajeAprobatorio,
      aleatorizar_preguntas: true, mostrar_resultados_al_candidato: false,
      estructura, cargos_sugeridos: [], tags: [],
    };

    try {
      const url = editing ? `/api/evaluaciones/plantillas/${editing.id}` : '/api/evaluaciones/plantillas';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await res.json();
      if (result.success) {
        toast.success(editing ? 'Plantilla actualizada' : 'Plantilla creada');
        setSheetOpen(false);
        fetchPlantillas();
      } else {
        toast.error(result.error || 'Error');
      }
    } catch {
      toast.error('Error de red');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    try {
      const res = await fetch(`/api/evaluaciones/plantillas/${id}`, { method: 'DELETE' });
      if ((await res.json()).success) {
        toast.success('Plantilla archivada');
        fetchPlantillas();
      }
    } catch {
      toast.error('Error');
    }
  }

  const totalPuntos = estructura.reduce((s, e) => s + e.cantidad * e.puntos_por_pregunta, 0);
  const totalPreguntas = estructura.reduce((s, e) => s + e.cantidad, 0);

  const previewEst: EstructuraPlantilla[] = previewTarget
    ? (typeof previewTarget.estructura === 'string' ? JSON.parse(previewTarget.estructura) : previewTarget.estructura)
    : [];
  const previewTotalPuntos = previewEst.reduce((s, e) => s + e.cantidad * e.puntos_por_pregunta, 0);

  return (
    <div className="animate-fade-in">
      <Breadcrumbs />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Plantillas de Evaluación</h1>
          <p className="text-muted-foreground">{plantillas.length} plantillas</p>
        </div>
        <Button className="bg-teal hover:bg-teal/90 gap-1.5" onClick={handleNew}>
          <Plus className="h-4 w-4" />
          Nueva Plantilla
        </Button>
      </div>

      <div className="mb-6 flex gap-3 items-start bg-blue-50 border border-blue-200 rounded-lg p-4">
        <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Para que sirven las plantillas?</p>
          <p className="text-blue-700">
            Las plantillas te permiten reutilizar configuraciones de evaluaciones tecnicas. En vez de armar la estructura desde cero cada vez, guardas una plantilla con el nombre, duracion, puntaje aprobatorio y estructura de preguntas (categorias, cantidad, dificultad y puntos). Despues, al crear una nueva evaluacion tecnica, seleccionas la plantilla y se pre-llena todo automaticamente — solo eliges vacante y candidato.
          </p>
        </div>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : plantillas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No hay plantillas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plantillas.map((p) => {
            const est: EstructuraPlantilla[] = typeof p.estructura === 'string' ? JSON.parse(p.estructura) : p.estructura;
            const total = est.reduce((s, e) => s + e.cantidad, 0);
            return (
              <Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleEdit(p)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{p.nombre}</CardTitle>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="Ver borrador"
                        onClick={(e) => handlePreview(e, p)}
                      >
                        <Eye className="h-3.5 w-3.5 text-teal" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={(e) => { e.stopPropagation(); handleArchive(p.id); }}
                      >
                        <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  {p.descripcion && <p className="text-xs text-muted-foreground">{p.descripcion}</p>}
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 text-xs text-muted-foreground mb-3">
                    <span>{total} preguntas</span>
                    <span>&middot;</span>
                    <span>{p.duracion_minutos} min</span>
                    <span>&middot;</span>
                    <span>Aprueba: {p.puntaje_aprobatorio}%</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {est.map((item, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">
                        {item.categoria} ({item.cantidad})
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sheet for create/edit */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar Plantilla' : 'Nueva Plantilla'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label>Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Evaluación Frontend Senior" className="mt-1" />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duración (min)</Label>
                <Input type="number" value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} min={5} max={480} className="mt-1" />
              </div>
              <div>
                <Label>Puntaje aprobatorio (%)</Label>
                <Input type="number" value={puntajeAprobatorio} onChange={(e) => setPuntajeAprobatorio(Number(e.target.value))} min={1} max={100} className="mt-1" />
              </div>
            </div>

            {/* Estructura */}
            <div>
              <Label>Estructura de preguntas</Label>
              <div className="space-y-2 mt-2">
                {estructura.map((item, i) => {
                  const catInfo = categorias.find(c => c.categoria === item.categoria);
                  return (
                    <div key={i} className="flex items-center gap-2 p-2 bg-soft-gray/50 rounded-lg">
                      <Input
                        value={item.categoria}
                        onChange={(e) => updateEstructura(i, 'categoria', e.target.value)}
                        list="cats-list"
                        placeholder="Categoría"
                        className="flex-1"
                        required
                      />
                      <Input
                        type="number"
                        value={item.cantidad}
                        onChange={(e) => updateEstructura(i, 'cantidad', Number(e.target.value))}
                        min={1}
                        className="w-16"
                        title="Cantidad"
                      />
                      <select
                        value={item.dificultad}
                        onChange={(e) => updateEstructura(i, 'dificultad', e.target.value)}
                        className="border rounded px-2 py-1 text-xs bg-white"
                      >
                        <option value="basico">Básico</option>
                        <option value="intermedio">Intermedio</option>
                        <option value="avanzado">Avanzado</option>
                        <option value="experto">Experto</option>
                        <option value="mixta">Mixta</option>
                      </select>
                      <Input
                        type="number"
                        value={item.puntos_por_pregunta}
                        onChange={(e) => updateEstructura(i, 'puntos_por_pregunta', Number(e.target.value))}
                        min={1}
                        className="w-16"
                        title="Puntos"
                      />
                      {estructura.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEstructura(estructura.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </Button>
                      )}
                      {catInfo && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {catInfo.total} disp.
                        </span>
                      )}
                    </div>
                  );
                })}
                <datalist id="cats-list">
                  {categorias.map(c => <option key={c.categoria} value={c.categoria} />)}
                </datalist>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEstructura([...estructura, { categoria: '', cantidad: 3, dificultad: 'intermedio', puntos_por_pregunta: 10 }])}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" /> Agregar categoría
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Total: {totalPreguntas} preguntas, {totalPuntos} puntos
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-teal hover:bg-teal/90" disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Plantilla'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Dialog: preview borrador */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="text-lg">{previewTarget?.nombre}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Borrador — selección aleatoria de preguntas del banco
            </p>
            {/* Stats */}
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Hash className="h-3.5 w-3.5" />
                <span>{previewPreguntas.length} preguntas</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{previewTarget?.duracion_minutos} min</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Award className="h-3.5 w-3.5" />
                <span>Aprueba {previewTarget?.puntaje_aprobatorio}% · {previewTotalPuntos} pts total</span>
              </div>
            </div>
          </DialogHeader>

          {/* Question list */}
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            {previewLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin" />
                <p className="text-sm">Seleccionando preguntas...</p>
              </div>
            ) : previewPreguntas.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No hay preguntas disponibles para esta estructura.
              </div>
            ) : (
              previewPreguntas.map((p, i) => (
                <div key={p.pregunta_id} className="border rounded-lg p-4 bg-white space-y-3">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-semibold text-muted-foreground mt-0.5 shrink-0 w-5">{i + 1}.</span>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium leading-snug">{p.enunciado}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[10px]">{p.categoria}</Badge>
                        <Badge className={`${DIFICULTAD_COLORS[p.dificultad]} text-[10px] border-0`}>{p.dificultad}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{TIPO_LABELS[p.tipo] ?? p.tipo}</Badge>
                        <span className="text-[10px] text-muted-foreground self-center">{p.puntos} pts · ~{Math.round(p.tiempo_estimado_segundos / 60)} min</span>
                      </div>
                    </div>
                  </div>

                  {/* Options for opcion_multiple */}
                  {p.tipo === 'opcion_multiple' && p.opciones && (
                    <div className="ml-8 space-y-1.5">
                      {p.opciones.map((op) => (
                        <div
                          key={op.id}
                          className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
                            op.es_correcta
                              ? 'bg-green-50 border border-green-200 text-green-800'
                              : 'bg-gray-50 border border-gray-100 text-gray-700'
                          }`}
                        >
                          {op.es_correcta
                            ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                            : <Circle className="h-4 w-4 text-gray-300 shrink-0 mt-0.5" />
                          }
                          <span>{op.id.toUpperCase()}. {op.texto}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Verdadero/falso */}
                  {p.tipo === 'verdadero_falso' && (
                    <div className="ml-8 flex gap-2">
                      {['Verdadero', 'Falso'].map((label) => {
                        const isCorrect =
                          p.respuesta_correcta?.toLowerCase() === label.toLowerCase() ||
                          (label === 'Verdadero' && p.respuesta_correcta === 'true') ||
                          (label === 'Falso' && p.respuesta_correcta === 'false');
                        return (
                          <div
                            key={label}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm border ${
                              isCorrect
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-gray-50 border-gray-100 text-gray-500'
                            }`}
                          >
                            {isCorrect ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Circle className="h-3.5 w-3.5 text-gray-300" />}
                            {label}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Respuesta abierta / código */}
                  {(p.tipo === 'respuesta_abierta' || p.tipo === 'codigo') && p.respuesta_correcta && (
                    <div className="ml-8 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Guía de evaluación</p>
                      <p className="text-xs text-amber-900 leading-relaxed">{p.respuesta_correcta}</p>
                    </div>
                  )}

                  {/* Explicación */}
                  {p.explicacion && (
                    <div className="ml-8 text-xs text-muted-foreground italic border-l-2 border-gray-200 pl-2">
                      {p.explicacion}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t shrink-0 flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={previewLoading || !previewTarget}
              onClick={() => previewTarget && loadPreview(previewTarget)}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
              Regenerar selección
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
