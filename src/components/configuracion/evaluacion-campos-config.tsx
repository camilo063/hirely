'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ChevronUp, ChevronDown } from 'lucide-react';

interface Campo {
  id?: string;
  campo_key: string;
  label: string;
  descripcion?: string | null;
  orden: number;
  min_valor: number;
  max_valor: number;
  activo: boolean;
}

export function EvaluacionCamposConfig() {
  const [campos, setCampos] = useState<Campo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchCampos = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracion/evaluacion-campos');
      if (res.ok) {
        const { data } = await res.json();
        setCampos(data || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampos();
  }, [fetchCampos]);

  // Actualiza el estado local sin persistir (para edicion controlada)
  const updateLocal = (idx: number, patch: Partial<Campo>) => {
    setCampos((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  // Persiste un campo (PUT). Si el campo aun no tiene id (default sin persistir),
  // hace un refetch tras crear via el flujo de "seed" del backend.
  const handleSave = async (campo: Campo) => {
    if (!campo.id) return;
    setSavingId(campo.id);
    try {
      const res = await fetch(`/api/configuracion/evaluacion-campos/${campo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: campo.label,
          descripcion: campo.descripcion ?? null,
          min_valor: campo.min_valor,
          max_valor: campo.max_valor,
          activo: campo.activo,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Campo actualizado');
    } catch {
      toast.error('Error al actualizar el campo');
      fetchCampos();
    } finally {
      setSavingId(null);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      const res = await fetch('/api/configuracion/evaluacion-campos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: 'Nuevo campo',
          descripcion: '',
          min_valor: 1,
          max_valor: 5,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Campo agregado');
      await fetchCampos();
    } catch {
      toast.error('Error al agregar el campo');
    } finally {
      setAdding(false);
    }
  };

  // Reordena moviendo un campo arriba/abajo, reindexa `orden` y persiste.
  const handleMove = async (idx: number, dir: 'up' | 'down') => {
    const j = dir === 'up' ? idx - 1 : idx + 1;
    if (j < 0 || j >= campos.length) return;
    const arr = [...campos];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    const reindexed = arr.map((c, i) => ({ ...c, orden: i }));
    setCampos(reindexed);
    try {
      await Promise.all(
        reindexed
          .filter((c) => c.id)
          .map((c) =>
            fetch(`/api/configuracion/evaluacion-campos/${c.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orden: c.orden }),
            })
          )
      );
    } catch {
      toast.error('Error al reordenar');
      fetchCampos();
    }
  };

  const handleDelete = async (campo: Campo) => {
    // Si aun no esta persistido (defaults), primero materializamos la config
    if (!campo.id) {
      toast.error('Guarda algún cambio antes de eliminar los campos por defecto');
      return;
    }
    try {
      const res = await fetch(`/api/configuracion/evaluacion-campos/${campo.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      toast.success('Campo eliminado');
      setCampos((prev) => prev.filter((c) => c.id !== campo.id));
    } catch {
      toast.error('Error al eliminar el campo');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campos de evaluación humana</CardTitle>
        <CardDescription>
          Define los criterios que el evaluador califica (de 1 a 5, con decimales)
          cuando un candidato pasa a &quot;A evaluar&quot;.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
          </div>
        ) : campos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No hay campos de evaluación configurados
          </div>
        ) : (
          <div className="space-y-2">
            {campos.map((campo, idx) => (
              <div
                key={campo.id || campo.campo_key}
                className="flex items-start gap-2 p-3 border rounded-lg"
              >
                <div className="flex flex-col shrink-0 pt-3.5">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Subir"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, 'up')}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Bajar"
                    disabled={idx === campos.length - 1}
                    onClick={() => handleMove(idx, 'down')}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <Label htmlFor={`label_${idx}`} className="text-xs text-muted-foreground">
                      Nombre del criterio
                    </Label>
                    <Input
                      id={`label_${idx}`}
                      value={campo.label}
                      onChange={(e) => updateLocal(idx, { label: e.target.value })}
                      onBlur={() => handleSave(campo)}
                      placeholder="Ej: Actitud"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`desc_${idx}`} className="text-xs text-muted-foreground">
                      Descripción
                    </Label>
                    <Input
                      id={`desc_${idx}`}
                      value={campo.descripcion ?? ''}
                      onChange={(e) => updateLocal(idx, { descripcion: e.target.value })}
                      onBlur={() => handleSave(campo)}
                      placeholder="Descripción breve (opcional)"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="w-24">
                      <Label htmlFor={`min_${idx}`} className="text-xs text-muted-foreground">
                        Mínimo
                      </Label>
                      <Input
                        id={`min_${idx}`}
                        type="number"
                        step={0.1}
                        value={campo.min_valor}
                        onChange={(e) => updateLocal(idx, { min_valor: Number(e.target.value) })}
                        onBlur={() => handleSave(campo)}
                      />
                    </div>
                    <div className="w-24">
                      <Label htmlFor={`max_${idx}`} className="text-xs text-muted-foreground">
                        Máximo
                      </Label>
                      <Input
                        id={`max_${idx}`}
                        type="number"
                        step={0.1}
                        value={campo.max_valor}
                        onChange={(e) => updateLocal(idx, { max_valor: Number(e.target.value) })}
                        onBlur={() => handleSave(campo)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pb-2.5">
                      Escala de calificación del criterio (ej. 1 a 5, o 1 a 6).
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 pt-5">
                  {savingId === campo.id && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive"
                    title="Eliminar campo"
                    onClick={() => handleDelete(campo)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={handleAdd} disabled={adding} className="gap-1.5">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Agregar campo
        </Button>
      </CardContent>
    </Card>
  );
}
