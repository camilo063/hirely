'use client';

import { useState } from 'react';
import { Loader2, UserCheck, Calendar, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScoreBadge } from '@/components/candidatos/score-badge';
import { toast } from 'sonner';

interface Props {
  aplicacionId: string;
  candidatoNombre: string;
  vacanteTitulo: string;
  scoreAts?: number | null;
  scoreIa?: number | null;
  scoreHumano?: number | null;
  scoreFinal?: number | null;
  vacanteId?: string;
  disabled?: boolean;
  onSuccess?: () => void;
}

export function SeleccionarCandidatoBtn({
  aplicacionId,
  candidatoNombre,
  vacanteTitulo,
  scoreAts,
  scoreIa,
  scoreHumano,
  scoreFinal,
  vacanteId,
  disabled,
  onSuccess,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tipoContrato, setTipoContrato] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [salario, setSalario] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [rechazarOtros, setRechazarOtros] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch('/api/seleccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aplicacion_id: aplicacionId,
          enviar_email_seleccion: enviarEmail,
          tipo_contrato: tipoContrato || undefined,
          fecha_inicio_tentativa: fechaInicio || undefined,
          salario_ofrecido: salario ? Number(salario) : undefined,
          moneda: 'COP',
          mensaje_personalizado: mensaje || undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Candidato seleccionado', {
          description: enviarEmail
            ? 'Email de seleccion enviado con link al portal de documentos.'
            : 'Portal de documentos generado.',
          action: data.data?.portalUrl ? {
            label: 'Copiar link',
            onClick: () => {
              navigator.clipboard.writeText(data.data.portalUrl);
              toast.info('Link copiado al portapapeles');
            },
          } : undefined,
        });

        // Optionally reject other candidates
        if (rechazarOtros && vacanteId) {
          // Get all non-selected aplicaciones for this vacante
          const appsRes = await fetch(`/api/vacantes/${vacanteId}/candidatos`);
          const appsData = await appsRes.json();
          if (appsData.success) {
            const otrosIds = (appsData.data || [])
              .filter((a: { id: string; estado: string }) => a.id !== aplicacionId && a.estado !== 'seleccionado' && a.estado !== 'descartado' && a.estado !== 'contratado')
              .map((a: { id: string }) => a.id);

            if (otrosIds.length > 0) {
              await fetch('/api/seleccion', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  aplicacion_ids: otrosIds,
                  enviar_email_rechazo: true,
                }),
              });
              toast.info(`${otrosIds.length} candidatos notificados como no seleccionados`);
            }
          }
        }

        setOpen(false);
        onSuccess?.();
      } else {
        toast.error(data.error || 'Error al seleccionar candidato');
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
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="gap-2 bg-success hover:bg-success/90 text-white"
      >
        <UserCheck className="h-4 w-4" />
        Seleccionar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar candidato</DialogTitle>
            <DialogDescription>
              Seleccionar a <strong>{candidatoNombre}</strong> para <strong>{vacanteTitulo}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Score summary */}
            <div className="flex items-center gap-4 bg-soft-gray rounded-lg p-3">
              {scoreAts != null && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">ATS</p>
                  <ScoreBadge score={Number(scoreAts)} size="sm" />
                </div>
              )}
              {scoreIa != null && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">IA</p>
                  <ScoreBadge score={Number(scoreIa)} size="sm" />
                </div>
              )}
              {scoreHumano != null && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Humano</p>
                  <ScoreBadge score={Number(scoreHumano)} size="sm" />
                </div>
              )}
              {scoreFinal != null && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-bold">Final</p>
                  <ScoreBadge score={Number(scoreFinal)} size="sm" />
                </div>
              )}
            </div>

            {/* Contract type */}
            <div>
              <Label className="text-sm">Tipo de contrato</Label>
              <select
                value={tipoContrato}
                onChange={(e) => setTipoContrato(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white mt-1"
              >
                <option value="">Sin especificar</option>
                <option value="laboral">Laboral</option>
                <option value="prestacion_servicios">Prestacion de servicios</option>
                <option value="horas_demanda">Horas/Demanda</option>
              </select>
            </div>

            {/* Start date */}
            <div>
              <Label className="text-sm flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Fecha inicio tentativa
              </Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Salary */}
            <div>
              <Label className="text-sm flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" /> Salario ofrecido (COP)
              </Label>
              <Input
                type="number"
                placeholder="Ej: 5000000"
                value={salario}
                onChange={(e) => setSalario(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Custom message */}
            <div>
              <Label className="text-sm">Mensaje personalizado</Label>
              <Textarea
                placeholder="Mensaje adicional en el email de seleccion..."
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>

            {/* Checkboxes */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={enviarEmail}
                  onCheckedChange={(v: boolean | 'indeterminate') => setEnviarEmail(!!v)}
                />
                Enviar email de felicitacion al candidato
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={rechazarOtros}
                  onCheckedChange={(v: boolean | 'indeterminate') => setRechazarOtros(!!v)}
                />
                Enviar email de rechazo a los demas candidatos
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-success hover:bg-success/90 text-white gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              Seleccionar y enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
