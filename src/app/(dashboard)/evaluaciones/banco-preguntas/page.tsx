'use client';

import { useEffect, useState, useCallback } from 'react';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { toast } from 'sonner';
import {
  Plus, Search, Upload, BookOpen, Edit2, Archive,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { PreguntaForm } from '@/components/evaluaciones/pregunta-form';
import type { PreguntaBanco, CategoriaConteo, Dificultad, TipoPregunta } from '@/lib/types/evaluacion-tecnica.types';

const DIFICULTAD_COLORS: Record<string, string> = {
  basico: 'bg-green-100 text-green-700',
  intermedio: 'bg-blue-100 text-blue-700',
  avanzado: 'bg-orange-100 text-orange-700',
  experto: 'bg-red-100 text-red-700',
};

const TIPO_LABELS: Record<string, string> = {
  opcion_multiple: 'Opción múltiple',
  verdadero_falso: 'V/F',
  respuesta_abierta: 'Abierta',
  codigo: 'Código',
};

export default function BancoPreguntasPage() {
  const [preguntas, setPreguntas] = useState<PreguntaBanco[]>([]);
  const [categorias, setCategorias] = useState<CategoriaConteo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterDif, setFilterDif] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPregunta, setEditingPregunta] = useState<PreguntaBanco | null>(null);

  const fetchPreguntas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCat) params.set('categoria', filterCat);
      if (filterDif) params.set('dificultad', filterDif);
      if (filterTipo) params.set('tipo', filterTipo);
      if (busqueda) params.set('busqueda', busqueda);
      params.set('limit', '100');

      const res = await fetch(`/api/evaluaciones/banco-preguntas?${params}`);
      const data = await res.json();
      if (data.success) {
        setPreguntas(data.data.preguntas || []);
        setTotal(data.data.total || 0);
      }
    } catch {
      toast.error('Error cargando preguntas');
    } finally {
      setLoading(false);
    }
  }, [filterCat, filterDif, filterTipo, busqueda]);

  const fetchCategorias = useCallback(async () => {
    try {
      const res = await fetch('/api/evaluaciones/banco-preguntas/categorias');
      const data = await res.json();
      if (data.success) setCategorias(data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchCategorias(); }, [fetchCategorias]);
  useEffect(() => { fetchPreguntas(); }, [fetchPreguntas]);

  function handleEdit(pregunta: PreguntaBanco) {
    setEditingPregunta(pregunta);
    setSheetOpen(true);
  }

  function handleNew() {
    setEditingPregunta(null);
    setSheetOpen(true);
  }

  async function handleArchive(id: string) {
    try {
      const res = await fetch(`/api/evaluaciones/banco-preguntas/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Pregunta archivada');
        fetchPreguntas();
        fetchCategorias();
      }
    } catch {
      toast.error('Error archivando pregunta');
    }
  }

  function handleSaved() {
    setSheetOpen(false);
    setEditingPregunta(null);
    fetchPreguntas();
    fetchCategorias();
  }

  const totalPreguntas = categorias.reduce((s, c) => s + c.total, 0);

  return (
    <div className="animate-fade-in">
      <Breadcrumbs />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Banco de Preguntas</h1>
          <p className="text-muted-foreground">{totalPreguntas} preguntas en {categorias.length} categorías</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" disabled>
            <Upload className="h-4 w-4" />
            Importar
          </Button>
          <Button className="bg-teal hover:bg-teal/90 gap-1.5" onClick={handleNew}>
            <Plus className="h-4 w-4" />
            Nueva Pregunta
          </Button>
        </div>
      </div>

      {/* Categories sidebar as horizontal chips */}
      {categorias.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge
            variant={filterCat === '' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilterCat('')}
          >
            Todas ({totalPreguntas})
          </Badge>
          {categorias.map((cat) => (
            <Badge
              key={cat.categoria}
              variant={filterCat === cat.categoria ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilterCat(filterCat === cat.categoria ? '' : cat.categoria)}
            >
              {cat.categoria} ({cat.total})
            </Badge>
          ))}
        </div>
      )}

      {/* Filters row */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por enunciado..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filterDif}
          onChange={(e) => setFilterDif(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Dificultad</option>
          <option value="basico">Básico</option>
          <option value="intermedio">Intermedio</option>
          <option value="avanzado">Avanzado</option>
          <option value="experto">Experto</option>
        </select>
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Tipo</option>
          <option value="opcion_multiple">Opción múltiple</option>
          <option value="verdadero_falso">V/F</option>
          <option value="respuesta_abierta">Abierta</option>
          <option value="codigo">Código</option>
        </select>
        {(filterCat || filterDif || filterTipo || busqueda) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFilterCat(''); setFilterDif(''); setFilterTipo(''); setBusqueda(''); }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : preguntas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No hay preguntas en el banco</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Agrega preguntas o ejecuta el seed de preguntas iniciales
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-soft-gray/50">
                  <th className="text-left px-4 py-3 font-medium w-[40%]">Enunciado</th>
                  <th className="text-left px-4 py-3 font-medium">Categoría</th>
                  <th className="text-center px-4 py-3 font-medium">Dificultad</th>
                  <th className="text-center px-4 py-3 font-medium">Tipo</th>
                  <th className="text-center px-4 py-3 font-medium">Puntos</th>
                  <th className="text-center px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {preguntas.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-soft-gray/30 transition-colors cursor-pointer" onClick={() => handleEdit(p)}>
                    <td className="px-4 py-3">
                      <p className="line-clamp-2">{p.enunciado}</p>
                      {p.tags && p.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {p.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{tag}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{p.categoria}</span>
                      {p.subcategoria && (
                        <span className="text-xs text-muted-foreground block">{p.subcategoria}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={DIFICULTAD_COLORS[p.dificultad] || ''}>
                        {p.dificultad}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                      {TIPO_LABELS[p.tipo] || p.tipo}
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{p.puntos}</td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEdit(p)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => handleArchive(p.id)}>
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > preguntas.length && (
            <div className="px-4 py-3 text-xs text-muted-foreground border-t">
              Mostrando {preguntas.length} de {total} preguntas
            </div>
          )}
        </Card>
      )}

      {/* Sheet for create/edit */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingPregunta ? 'Editar Pregunta' : 'Nueva Pregunta'}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <PreguntaForm
              pregunta={editingPregunta}
              categorias={categorias.map(c => c.categoria)}
              onSaved={handleSaved}
              onCancel={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
