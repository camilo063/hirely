'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle, Loader2 } from 'lucide-react';

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

interface EvaluacionHumanaModalProps {
  aplicacionId: string;
  candidatoNombre: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Modal de evaluacion humana. Al abrir carga los campos configurables de la
 * organizacion y captura una calificacion (min..max, decimales) por cada uno.
 * Al guardar hace POST /api/aplicaciones/[id]/evaluacion-humana, lo que calcula
 * score_humano, recalcula score_final y transiciona la aplicacion a 'evaluado'.
 */
export function EvaluacionHumanaModal({
  aplicacionId,
  candidatoNombre,
  open,
  onOpenChange,
  onSuccess,
}: EvaluacionHumanaModalProps) {
  const [campos, setCampos] = useState<Campo[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState('');
  const [loadingCampos, setLoadingCampos] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchCampos = useCallback(async () => {
    setLoadingCampos(true);
    try {
      const res = await fetch('/api/configuracion/evaluacion-campos');
      if (res.ok) {
        const { data } = await res.json();
        const list: Campo[] = data || [];
        setCampos(list);
        // Prellenar con el punto medio del rango
        const init: Record<string, string> = {};
        for (const c of list) {
          init[c.campo_key] = String((c.min_valor + c.max_valor) / 2);
        }
        setValores(init);
      }
    } catch {
      toast.error('Error al cargar los campos de evaluación');
    } finally {
      setLoadingCampos(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setObservaciones('');
      fetchCampos();
    }
  }, [open, fetchCampos]);

  const handleSubmit = async () => {
    // Validar que todos los campos tengan un valor en rango
    const parsed: Record<string, number> = {};
    for (const campo of campos) {
      const raw = valores[campo.campo_key];
      const num = Number(raw);
      if (raw === '' || raw === undefined || Number.isNaN(num)) {
        toast.error(`Ingresa un valor para "${campo.label}"`);
        return;
      }
      if (num < campo.min_valor || num > campo.max_valor) {
        toast.error(`"${campo.label}" debe estar entre ${campo.min_valor} y ${campo.max_valor}`);
        return;
      }
      parsed[campo.campo_key] = num;
    }

    if (campos.length === 0) {
      toast.error('No hay campos de evaluación configurados');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/aplicaciones/${aplicacionId}/evaluacion-humana`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valores: parsed, observaciones: observaciones || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Error al guardar la evaluación');
      }
      toast.success('Evaluación guardada');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al guardar la evaluación');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evaluación humana</DialogTitle>
          <DialogDescription>{candidatoNombre}</DialogDescription>
        </DialogHeader>

        {loadingCampos ? (
          <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando campos...
          </div>
        ) : (
          <div className="space-y-4">
            {campos.map((campo) => (
              <div key={campo.campo_key}>
                <Label htmlFor={`campo_${campo.campo_key}`}>
                  {campo.label}
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    ({campo.min_valor}–{campo.max_valor})
                  </span>
                </Label>
                {campo.descripcion && (
                  <p className="text-xs text-muted-foreground mb-1">{campo.descripcion}</p>
                )}
                <Input
                  id={`campo_${campo.campo_key}`}
                  type="number"
                  min={campo.min_valor}
                  max={campo.max_valor}
                  step={0.1}
                  value={valores[campo.campo_key] ?? ''}
                  onChange={(e) =>
                    setValores((prev) => ({ ...prev, [campo.campo_key]: e.target.value }))
                  }
                />
              </div>
            ))}

            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Comentarios adicionales (opcional)"
                rows={3}
              />
            </div>

            <Button onClick={handleSubmit} disabled={saving || campos.length === 0} className="w-full">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Guardar evaluación
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
