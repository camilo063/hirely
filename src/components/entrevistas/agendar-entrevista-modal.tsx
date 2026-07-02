'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CalendarClock, Loader2, Video } from 'lucide-react';

interface AgendarEntrevistaModalProps {
  aplicacionId: string;
  candidatoId: string;
  vacanteId: string;
  candidatoNombre: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Modal controlado para agendar una entrevista humana con generacion
 * automatica de link de Google Meet. Hace POST /api/entrevistas con
 * tipo="humana" y crear_evento_calendar=true.
 */
export function AgendarEntrevistaModal({
  aplicacionId,
  candidatoId,
  vacanteId,
  candidatoNombre,
  open,
  onOpenChange,
  onSuccess,
}: AgendarEntrevistaModalProps) {
  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState('');
  const [entrevistadorId, setEntrevistadorId] = useState('');
  const [notas, setNotas] = useState('');
  const [usuarios, setUsuarios] = useState<{ id: string; name: string }[]>([]);
  const [meetLink, setMeetLink] = useState<string | null>(null);

  const fetchUsuarios = useCallback(async () => {
    try {
      const res = await fetch('/api/users?role=admin,recruiter');
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data.data || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (open) {
      fetchUsuarios();
      setMeetLink(null);
    }
  }, [open, fetchUsuarios]);

  const handleSubmit = async () => {
    if (!fecha) {
      toast.error('La fecha y hora son requeridas');
      return;
    }
    if (!entrevistadorId) {
      toast.error('El entrevistador es requerido');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/entrevistas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'humana',
          aplicacion_id: aplicacionId,
          candidato_id: candidatoId,
          vacante_id: vacanteId,
          entrevistador_id: entrevistadorId,
          fecha_programada: new Date(fecha).toISOString(),
          notas: notas || undefined,
          crear_evento_calendar: true,
        }),
      });

      const json = await res.json().catch(() => ({}));
      const data = json?.data;

      if (!res.ok) {
        throw new Error(json?.error || 'Error al agendar');
      }

      const link: string | null = data?.meet_link || null;
      if (link) {
        setMeetLink(link);
        toast.success('Entrevista agendada', {
          description: 'Link de Google Meet generado.',
        });
      } else {
        toast.success('Entrevista agendada. Conecta Google Calendar para generar el link de Meet automáticamente.');
      }

      onSuccess?.();
      if (!link) {
        onOpenChange(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al agendar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar entrevista</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium">{candidatoNombre}</p>
            <p className="text-sm text-muted-foreground">Entrevista humana por Google Meet</p>
          </div>

          <div>
            <Label htmlFor="fecha_entrevista">Fecha y hora *</Label>
            <Input
              id="fecha_entrevista"
              type="datetime-local"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
            />
          </div>

          <div>
            <Label>Entrevistador *</Label>
            <Select value={entrevistadorId} onValueChange={setEntrevistadorId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar entrevistador" />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notas_entrevista">Notas</Label>
            <Textarea
              id="notas_entrevista"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Temas a tratar, instrucciones, etc. (opcional)"
              rows={2}
            />
          </div>

          {meetLink && (
            <div className="border rounded-md p-3 bg-teal/5 space-y-2">
              <p className="text-sm font-medium flex items-center gap-1.5 text-teal-700">
                <Video className="h-4 w-4" /> Link de Google Meet
              </p>
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-teal hover:underline break-all"
              >
                {meetLink}
              </a>
            </div>
          )}

          {meetLink ? (
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Cerrar
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading || !fecha || !entrevistadorId}
              className="w-full bg-teal hover:bg-teal/90"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarClock className="h-4 w-4 mr-2" />}
              Agendar y generar Meet
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
