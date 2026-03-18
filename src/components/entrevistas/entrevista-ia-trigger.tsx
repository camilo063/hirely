'use client';

import { useState } from 'react';
import { Phone, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Props {
  aplicacionId: string;
  candidatoNombre: string;
  candidatoTelefono: string | null;
  vacanteTitulo: string;
  disabled?: boolean;
  onSuccess?: () => void;
}

export function EntrevistaIATrigger({ aplicacionId, candidatoNombre, candidatoTelefono, vacanteTitulo, disabled, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preguntasExtra, setPreguntasExtra] = useState('');

  const handleIniciar = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/entrevistas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aplicacion_id: aplicacionId,
          preguntas: preguntasExtra ? preguntasExtra.split('\n').filter(Boolean) : undefined,
        }),
      });

      const data = await res.json();

      if (data.data?.status === 'initiated') {
        toast.success('Entrevista IA iniciada', {
          description: `Se esta llamando a ${candidatoNombre}...`,
        });
        setOpen(false);
        onSuccess?.();
      } else if (data.data?.status === 'dapta_not_configured') {
        toast.warning('Dapta no configurado', {
          description: 'La entrevista se creo pero necesita configurar DAPTA_FLOW_WEBHOOK_URL para activar llamadas automaticas.',
        });
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error('Error', { description: data.data?.error || 'No se pudo iniciar la entrevista' });
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={disabled || !candidatoTelefono}
        variant="default"
        size="sm"
        className="gap-2 bg-teal hover:bg-teal/90"
      >
        <Phone className="h-4 w-4" />
        Entrevista IA
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar Entrevista IA</DialogTitle>
            <DialogDescription>
              El agente de IA llamara a <strong>{candidatoNombre}</strong> al numero{' '}
              <strong>{candidatoTelefono}</strong> para una entrevista sobre{' '}
              <strong>{vacanteTitulo}</strong>.
            </DialogDescription>
          </DialogHeader>

          {!candidatoTelefono && (
            <div className="flex items-center gap-2 p-3 bg-orange/10 border border-orange/30 rounded-lg text-sm text-orange">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              El candidato no tiene telefono registrado.
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Preguntas adicionales (opcional)</label>
            <Textarea
              placeholder="Una pregunta por linea. Se agregaran a las preguntas por defecto."
              value={preguntasExtra}
              onChange={(e) => setPreguntasExtra(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Las preguntas por defecto incluyen tecnicas, motivacionales y de cultura organizacional.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleIniciar}
              disabled={loading || !candidatoTelefono}
              className="gap-2 bg-teal hover:bg-teal/90"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              {loading ? 'Iniciando...' : 'Llamar ahora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
