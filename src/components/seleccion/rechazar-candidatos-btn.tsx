'use client';

import { useState } from 'react';
import { Loader2, UserX, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Props {
  /** Single rejection: one aplicacion_id */
  aplicacionId?: string;
  candidatoNombre?: string;
  /** Bulk rejection: array of aplicacion_ids */
  aplicacionIds?: string[];
  count?: number;
  vacanteTitulo?: string;
  onSuccess?: () => void;
}

export function RechazarCandidatosBtn({
  aplicacionId,
  candidatoNombre,
  aplicacionIds,
  count,
  vacanteTitulo,
  onSuccess,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [enviarEmail, setEnviarEmail] = useState(true);

  const isBulk = !!aplicacionIds && aplicacionIds.length > 0;
  const ids = isBulk ? aplicacionIds : aplicacionId ? [aplicacionId] : [];
  const displayCount = count || ids.length;

  async function handleSubmit() {
    if (ids.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/seleccion', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aplicacion_ids: ids,
          enviar_email_rechazo: enviarEmail,
          mensaje_personalizado: mensaje || undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        const result = data.data;
        if (isBulk) {
          toast.success(`${result.enviados} candidato(s) notificado(s)`, {
            description: result.errores > 0
              ? `${result.errores} con error`
              : enviarEmail
                ? 'Emails de agradecimiento enviados'
                : 'Estados actualizados',
          });
        } else {
          toast.success('Candidato descartado');
        }
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error(data.error || 'Error');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant={isBulk ? 'outline' : 'ghost'}
        size="sm"
        onClick={() => setOpen(true)}
        className={isBulk ? 'gap-2 text-orange border-orange/30 hover:bg-orange/10' : 'gap-1 text-red-500'}
      >
        {isBulk ? <Users className="h-4 w-4" /> : <UserX className="h-3.5 w-3.5" />}
        {isBulk ? 'Notificar no seleccionados' : 'Descartar'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {isBulk ? 'Notificar a no seleccionados' : 'Descartar candidato'}
            </DialogTitle>
            <DialogDescription>
              {isBulk
                ? `Enviar email de agradecimiento a ${displayCount} candidato(s) no seleccionado(s)${vacanteTitulo ? ` de "${vacanteTitulo}"` : ''}.`
                : `Descartar a ${candidatoNombre || 'este candidato'} del proceso.`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm">Mensaje personalizado (opcional)</Label>
              <Textarea
                placeholder="Mensaje adicional en el email..."
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={enviarEmail}
                onCheckedChange={(v: boolean | 'indeterminate') => setEnviarEmail(!!v)}
              />
              Enviar email de agradecimiento
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              variant="destructive"
              className="gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
              {isBulk ? 'Notificar' : 'Descartar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
