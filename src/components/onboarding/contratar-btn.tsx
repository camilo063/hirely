'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle, Mail, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import {
  PLANTILLA_BIENVENIDA_DEFAULT,
  VARIABLES_DISPONIBLES,
} from '@/lib/types/onboarding.types';

interface Props {
  aplicacionId: string;
  candidatoNombre: string;
  vacanteTitulo: string;
  fechaInicioTentativa?: string;
  documentosCompletos: boolean;
  disabled?: boolean;
  onSuccess?: () => void;
}

export function ContratarBtn({
  aplicacionId,
  candidatoNombre,
  vacanteTitulo,
  fechaInicioTentativa,
  documentosCompletos,
  disabled,
  onSuccess,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(fechaInicioTentativa || '');
  const [liderId, setLiderId] = useState('');
  const [notas, setNotas] = useState('');
  const [enviarAhora, setEnviarAhora] = useState(true);
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
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aplicacion_id: aplicacionId,
          fecha_inicio: fechaInicio,
          lider_id: liderId || undefined,
          notas: notas || undefined,
          enviar_email_ahora: enviarAhora,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al contratar');
      }

      const fechaFormat = new Date(fechaInicio + 'T12:00:00').toLocaleDateString('es-CO', {
        day: 'numeric', month: 'long', year: 'numeric',
      });

      toast.success(
        enviarAhora
          ? `Contratación confirmada. Email de bienvenida enviado.`
          : `Contratación confirmada. Email programado para el ${fechaFormat}.`
      );

      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Error al procesar contratación');
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

  if (!documentosCompletos) {
    return (
      <Button size="sm" disabled variant="outline" className="gap-1.5 text-muted-foreground">
        <CheckCircle className="h-4 w-4" />
        Contratar (docs pendientes)
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled} className="gap-1.5 bg-success hover:bg-success/90 text-white">
          <CheckCircle className="h-4 w-4" />
          Contratar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar contratación</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Candidate summary */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium">{candidatoNombre}</p>
            <p className="text-sm text-muted-foreground">{vacanteTitulo}</p>
          </div>

          {/* Fecha de inicio */}
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

          {/* Líder directo */}
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

          {/* Notas */}
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

          {/* Email timing */}
          <div>
            <Label className="mb-2 block">Email de bienvenida</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md border hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  name="email_timing"
                  checked={enviarAhora}
                  onChange={() => setEnviarAhora(true)}
                  className="accent-teal-500"
                />
                <Mail className="h-4 w-4 text-teal-500" />
                <span className="text-sm">Enviar ahora</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md border hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  name="email_timing"
                  checked={!enviarAhora}
                  onChange={() => setEnviarAhora(false)}
                  className="accent-teal-500"
                />
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Programar para la fecha de inicio</span>
              </label>
            </div>
          </div>

          {/* Preview toggle */}
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

          {/* Submit */}
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
