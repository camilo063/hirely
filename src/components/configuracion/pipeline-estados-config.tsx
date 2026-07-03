'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { toast } from 'sonner';
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { PipelineState } from '@/lib/constants/pipeline-states';
import { refreshPipelineEstados } from '@/hooks/usePipelineEstados';

// Estados estructurales: no se pueden desactivar ni mover (solo renombrar).
const ESTADOS_ESTRUCTURALES = new Set([
  'nuevo',
  'descartado',
  'contratado',
  'contrato_terminado',
]);

const TITLE_ESTRUCTURAL = 'Estado estructural: no se puede mover ni desactivar, solo renombrar';

export function PipelineEstadosConfig() {
  const [estados, setEstados] = useState<PipelineState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchEstados = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracion/pipeline-estados');
      if (res.ok) {
        const { data } = await res.json();
        setEstados((data?.estados || []).slice().sort((a: PipelineState, b: PipelineState) => a.orden - b.orden));
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEstados(); }, [fetchEstados]);

  const handleLabelChange = (key: string, label: string) => {
    setEstados(prev => prev.map(e => (e.key === key ? { ...e, label } : e)));
  };

  const handleToggleActivo = (key: string, activo: boolean) => {
    setEstados(prev => prev.map(e => (e.key === key ? { ...e, activo } : e)));
  };

  // Intercambia el `orden` con el vecino (arriba = -1, abajo = +1) en la lista ordenada.
  const handleMove = (index: number, direction: -1 | 1) => {
    setEstados(prev => {
      const sorted = prev.slice().sort((a, b) => a.orden - b.orden);
      const target = index + direction;
      if (target < 0 || target >= sorted.length) return prev;

      const current = sorted[index];
      const neighbor = sorted[target];
      // No mover estados estructurales, ni cruzar por encima/debajo de uno estructural.
      if (ESTADOS_ESTRUCTURALES.has(current.key) || ESTADOS_ESTRUCTURALES.has(neighbor.key)) {
        return prev;
      }

      const ordenCurrent = current.orden;
      const ordenNeighbor = neighbor.orden;
      return prev
        .map(e => {
          if (e.key === current.key) return { ...e, orden: ordenNeighbor };
          if (e.key === neighbor.key) return { ...e, orden: ordenCurrent };
          return e;
        })
        .sort((a, b) => a.orden - b.orden);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = estados.map(e => ({
        estado_key: e.key,
        label: e.label,
        orden: e.orden,
        activo: e.activo !== false,
      }));
      const res = await fetch('/api/configuracion/pipeline-estados', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estados: payload }),
      });
      if (!res.ok) throw new Error();
      refreshPipelineEstados(); // invalida el cache para que el pipeline refleje los cambios
      toast.success('Estados actualizados');
    } catch {
      toast.error('Error al guardar los estados');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CollapsibleCard
      title="Estados del pipeline"
      description="Renombra, reordena y activa/desactiva las etapas del proceso de selección. El orden se respeta: no se puede pasar a una etapa sin completar la anterior (excepto Descartado)."
      aside={
        !loading ? (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {estados.length} etapas
          </span>
        ) : null
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {estados.map((estado, index) => {
              const estructural = ESTADOS_ESTRUCTURALES.has(estado.key);
              return (
                <div
                  key={estado.key}
                  className="flex items-center gap-2 rounded-lg border p-2.5"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                    {index + 1}
                  </span>

                  <div className="flex flex-col shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-4 w-5 p-0"
                      disabled={estructural || index === 0}
                      title={estructural ? TITLE_ESTRUCTURAL : 'Subir'}
                      onClick={() => handleMove(index, -1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-4 w-5 p-0"
                      disabled={estructural || index === estados.length - 1}
                      title={estructural ? TITLE_ESTRUCTURAL : 'Bajar'}
                      onClick={() => handleMove(index, 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${estado.color}`} />

                  <div className="flex-1 min-w-0">
                    <Input
                      value={estado.label}
                      onChange={e => handleLabelChange(estado.key, e.target.value)}
                      className="h-8"
                    />
                  </div>

                  <Checkbox
                    id={`activo-${estado.key}`}
                    checked={estado.activo !== false}
                    disabled={estructural}
                    title={estructural ? TITLE_ESTRUCTURAL : 'Activar / desactivar etapa'}
                    onCheckedChange={(v) => handleToggleActivo(estado.key, v === true)}
                    className="shrink-0"
                  />
                  <Label
                    htmlFor={`activo-${estado.key}`}
                    className="shrink-0 cursor-pointer text-xs text-muted-foreground"
                  >
                    Activo
                  </Label>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Guardar
            </Button>
          </div>
        </>
      )}
    </CollapsibleCard>
  );
}
