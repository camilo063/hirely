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
  Plus, FileText, Edit2, Archive, Trash2, Info,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import type { EvaluacionPlantilla, EstructuraPlantilla, Dificultad, CategoriaConteo } from '@/lib/types/evaluacion-tecnica.types';

const DIFICULTAD_COLORS: Record<string, string> = {
  basico: 'bg-green-100 text-green-700',
  intermedio: 'bg-blue-100 text-blue-700',
  avanzado: 'bg-orange-100 text-orange-700',
  experto: 'bg-red-100 text-red-700',
  mixta: 'bg-purple-100 text-purple-700',
};

export default function PlantillasPage() {
  const [plantillas, setPlantillas] = useState<EvaluacionPlantilla[]>([]);
  const [categorias, setCategorias] = useState<CategoriaConteo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<EvaluacionPlantilla | null>(null);

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
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleArchive(p.id); }}>
                      <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
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
    </div>
  );
}
