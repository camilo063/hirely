'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';

interface Plantilla {
  id: string;
  nombre: string;
  duracion_minutos: number;
  puntaje_aprobatorio: number;
}

interface EnviarPruebaModalProps {
  aplicacionId: string;
  candidatoId: string;
  vacanteId: string;
  candidatoNombre: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Modal controlado para enviar una prueba tecnica a un candidato puntual desde
 * el pipeline. No existe un endpoint atomico de "crear y enviar": encadena
 * POST /api/evaluaciones (crea con los datos de la plantilla) y luego
 * POST /api/evaluaciones/{id}/enviar (envia el correo con el token).
 */
export function EnviarPruebaModal({
  aplicacionId,
  candidatoId,
  vacanteId,
  candidatoNombre,
  open,
  onOpenChange,
  onSuccess,
}: EnviarPruebaModalProps) {
  const [loading, setLoading] = useState(false);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [plantillaId, setPlantillaId] = useState('');

  const fetchPlantillas = useCallback(async () => {
    try {
      const res = await fetch('/api/evaluaciones/plantillas');
      if (res.ok) {
        const data = await res.json();
        setPlantillas(data.data || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (open) fetchPlantillas();
  }, [open, fetchPlantillas]);

  const handleSubmit = async () => {
    const plantilla = plantillas.find((p) => p.id === plantillaId);
    if (!plantilla) {
      toast.error('Selecciona una plantilla');
      return;
    }

    setLoading(true);
    try {
      const creado = await fetch('/api/evaluaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aplicacion_id: aplicacionId,
          candidato_id: candidatoId,
          vacante_id: vacanteId,
          plantilla_id: plantilla.id,
          titulo: plantilla.nombre,
          duracion_minutos: plantilla.duracion_minutos,
          puntaje_aprobatorio: plantilla.puntaje_aprobatorio,
        }),
      });
      const creadoJson = await creado.json().catch(() => ({}));
      if (!creado.ok) throw new Error(creadoJson?.error || 'Error creando la evaluacion');

      const evalId = creadoJson.data.id;
      const enviado = await fetch(`/api/evaluaciones/${evalId}/enviar`, { method: 'POST' });
      const enviadoJson = await enviado.json().catch(() => ({}));
      if (!enviado.ok) throw new Error(enviadoJson?.error || 'La evaluacion se creo pero no se pudo enviar');

      toast.success('Prueba tecnica enviada');
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error enviando la prueba tecnica');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar prueba tecnica</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium">{candidatoNombre}</p>
          </div>

          <div>
            <Label>Plantilla *</Label>
            <Select value={plantillaId} onValueChange={setPlantillaId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plantilla" />
              </SelectTrigger>
              <SelectContent>
                {plantillas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {plantillas.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                No hay plantillas disponibles. Crea una en Evaluaciones {'>'} Plantillas.
              </p>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || !plantillaId}
            className="w-full bg-teal hover:bg-teal/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar prueba
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
