'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle, Mail, Clock, Ban, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import {
  PLANTILLA_BIENVENIDA_DEFAULT,
  VARIABLES_DISPONIBLES,
} from '@/lib/types/onboarding.types';

type EnvioOpcion = 'ahora' | 'programado' | 'manual';

interface ContratarModalProps {
  aplicacionId: string;
  candidatoNombre: string;
  vacanteTitulo: string;
  fechaInicioTentativa?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Modal de contratacion reutilizable. Al confirmar, pasa la aplicacion a
 * 'contratado' via PATCH /api/aplicaciones/[id]/estado, adjuntando los datos
 * de onboarding (fecha, lider, notas) y la decision de envio del email.
 * Lo usan tanto el boton "Contratar" como el selector de estado.
 */
export function ContratarModal({
  aplicacionId,
  candidatoNombre,
  vacanteTitulo,
  fechaInicioTentativa,
  open,
  onOpenChange,
  onSuccess,
}: ContratarModalProps) {
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(fechaInicioTentativa || '');
  const [liderId, setLiderId] = useState('');
  const [notas, setNotas] = useState('');
  const [envio, setEnvio] = useState<EnvioOpcion>('ahora');
  const [showPreview, setShowPreview] = useState(false);
  const [usuarios, setUsuarios] = useState<{ id: string; name: string }[]>([]);

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
    if (open) fetchUsuarios();
  }, [open, fetchUsuarios]);

  const handleSubmit = async () => {
    if (!fechaInicio) {
      toast.error('La fecha de inicio es requerida');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/aplicaciones/${aplicacionId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'contratado',
          onboarding: {
            fecha_inicio: fechaInicio,
            lider_id: liderId || null,
            notas: notas || null,
            envio,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Error al contratar');
      }

      const fechaFormat = new Date(fechaInicio + 'T12:00:00').toLocaleDateString('es-CO', {
        day: 'numeric', month: 'long', year: 'numeric',
      });

      if (envio === 'ahora') {
        toast.success('Contratación confirmada. Email de bienvenida enviado.');
      } else if (envio === 'programado') {
        toast.success(`Contratación confirmada. Email programado para el ${fechaFormat}.`);
      } else {
        toast.success('Contratación confirmada. Envía el email de onboarding cuando quieras desde la sección Onboarding.');
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al procesar contratación');
    } finally {
      setLoading(false);
    }
  };

  const previewHtml = (() => {
    if (!showPreview) return '';
    let html = PLANTILLA_BIENVENIDA_DEFAULT;
    const examples: Record<string, string> = {};
    for (const v of VARIABLES_DISPONIBLES) examples[v.key] = v.ejemplo;
    examples.nombre_empleado = candidatoNombre;
    examples.cargo = vacanteTitulo;
    for (const [key, value] of Object.entries(examples)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
    }
    return html;
  })();

  const opciones: { key: EnvioOpcion; icon: React.ReactNode; label: string }[] = [
    { key: 'ahora', icon: <Mail className="h-4 w-4 text-teal-500" />, label: 'Enviar ahora' },
    { key: 'programado', icon: <Clock className="h-4 w-4 text-blue-500" />, label: 'Programar para la fecha de inicio' },
    { key: 'manual', icon: <Ban className="h-4 w-4 text-muted-foreground" />, label: 'No enviar aún (lo envío manualmente después)' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar contratación</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium">{candidatoNombre}</p>
            <p className="text-sm text-muted-foreground">{vacanteTitulo}</p>
          </div>

          <div>
            <Label htmlFor="fecha_inicio">Fecha de inicio laboral *</Label>
            <Input
              id="fecha_inicio"
              type="date"
              value={fechaInicio}
              onChange={e => setFechaInicio(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <Label>Líder directo</Label>
            <Select value={liderId} onValueChange={setLiderId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar líder (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notas">Notas de onboarding</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Instrucciones especiales, equipo a entregar, etc."
              rows={2}
            />
          </div>

          <div>
            <Label className="mb-2 block">Email de bienvenida</Label>
            <div className="space-y-2">
              {opciones.map(op => (
                <label
                  key={op.key}
                  className="flex items-center gap-2 cursor-pointer p-2 rounded-md border hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="radio"
                    name="email_timing"
                    checked={envio === op.key}
                    onChange={() => setEnvio(op.key)}
                    className="accent-teal-500"
                  />
                  {op.icon}
                  <span className="text-sm">{op.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {showPreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Vista previa del email
          </button>
          {showPreview && (
            <div
              className="border rounded-md p-4 max-h-60 overflow-y-auto bg-white text-sm"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          )}

          <Button
            onClick={handleSubmit}
            disabled={loading || !fechaInicio}
            className="w-full bg-success hover:bg-success/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Confirmar contratación
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
