'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const MOTIVOS = [
  { value: 'renuncia', label: 'Renuncia voluntaria' },
  { value: 'mutuo_acuerdo', label: 'Terminacion por mutuo acuerdo' },
  { value: 'justa_causa', label: 'Terminacion con justa causa' },
  { value: 'vencimiento', label: 'Vencimiento de contrato' },
  { value: 'traslado', label: 'Traslado / cambio de cargo interno' },
  { value: 'otro', label: 'Otro' },
];

interface Props {
  aplicacionId: string;
  candidatoNombre: string;
  vacanteTitulo: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTerminado: () => void;
}

export function DialogTerminacionContrato({
  aplicacionId, candidatoNombre, vacanteTitulo,
  open, onOpenChange, onTerminado,
}: Props) {
  const [motivo, setMotivo] = useState('');
  const [motivoDetalle, setMotivoDetalle] = useState('');
  const [fechaTerminacion, setFechaTerminacion] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!motivo || !fechaTerminacion) {
      toast.error('Motivo y fecha de terminacion son requeridos');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/aplicaciones/${aplicacionId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'contrato_terminado',
          motivo,
          motivo_detalle: motivoDetalle || undefined,
          fecha_terminacion: fechaTerminacion,
          notas: notas || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Terminacion de contrato registrada');
        onTerminado();
        onOpenChange(false);
      } else {
        toast.error(data.data?.error || data.error || 'Error registrando terminacion');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar terminacion de contrato</DialogTitle>
          <DialogDescription>
            {candidatoNombre} — {vacanteTitulo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium">Motivo de terminacion *</Label>
            <div className="mt-2 space-y-2">
              {MOTIVOS.map((m) => (
                <label key={m.value} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="motivo"
                    value={m.value}
                    checked={motivo === m.value}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="accent-teal h-4 w-4"
                  />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Descripcion (opcional)</Label>
            <Textarea
              value={motivoDetalle}
              onChange={(e) => setMotivoDetalle(e.target.value)}
              placeholder="Detalles adicionales sobre la terminacion..."
              rows={2}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Fecha de terminacion *</Label>
            <Input
              type="date"
              value={fechaTerminacion}
              onChange={(e) => setFechaTerminacion(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label>Notas internas (no se envian al candidato)</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas internas del equipo..."
              rows={2}
              className="mt-1"
            />
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
            Esta accion registrara el fin de la relacion laboral. El estado quedara como &quot;Contrato terminado&quot;.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!motivo || !fechaTerminacion || loading}
            className="bg-slate-600 hover:bg-slate-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Registrar terminacion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
