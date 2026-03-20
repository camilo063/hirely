'use client';

import { useState } from 'react';
import { Check, Lock, Zap, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  PIPELINE_STATES_CONFIG,
  PIPELINE_STATES_MAP,
  getTransicionesPermitidas,
  type TransicionInfo,
} from '@/lib/constants/pipeline-states';
import { DialogTerminacionContrato } from './dialog-terminacion-contrato';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SelectorEstadoAplicacionProps {
  aplicacionId: string;
  estadoActual: string;
  estadosCompletados: string[];
  candidatoNombre: string;
  onEstadoCambiado?: () => void;
  size?: 'sm' | 'md';
}

const STATE_BADGE_COLORS: Record<string, string> = {
  nuevo: 'bg-gray-100 text-gray-700 border-gray-300',
  en_revision: 'bg-blue-100 text-blue-700 border-blue-300',
  revisado: 'bg-blue-100 text-blue-700 border-blue-300',
  preseleccionado: 'bg-violet-100 text-violet-700 border-violet-300',
  entrevista_ia: 'bg-amber-100 text-amber-700 border-amber-300',
  evaluado: 'bg-teal-100 text-teal-700 border-teal-300',
  entrevista_humana: 'bg-pink-100 text-pink-700 border-pink-300',
  seleccionado: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  documentos_pendientes: 'bg-orange-100 text-orange-700 border-orange-300',
  documentos_completos: 'bg-lime-100 text-lime-700 border-lime-300',
  contratado: 'bg-green-100 text-green-700 border-green-300',
  contrato_terminado: 'bg-slate-100 text-slate-700 border-slate-300',
  descartado: 'bg-red-100 text-red-700 border-red-300',
};

function getStateBadgeColor(key: string): string {
  return STATE_BADGE_COLORS[key] || 'bg-gray-100 text-gray-700 border-gray-300';
}

export function SelectorEstadoAplicacion({
  aplicacionId,
  estadoActual,
  estadosCompletados,
  candidatoNombre,
  onEstadoCambiado,
  size = 'md',
}: SelectorEstadoAplicacionProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [terminacionOpen, setTerminacionOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    estado: string;
    title: string;
    description: string;
  }>({ open: false, estado: '', title: '', description: '' });

  const currentState = PIPELINE_STATES_MAP.get(estadoActual);
  const transiciones = getTransicionesPermitidas(estadoActual, estadosCompletados);

  async function cambiarEstado(nuevoEstado: string, motivoDescarte?: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/aplicaciones/${aplicacionId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: nuevoEstado,
          ...(motivoDescarte ? { motivo_descarte: motivoDescarte } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Check for contrato feedback
        if (data.data?.contratoEnviado === true) {
          toast.success('Candidato contratado', {
            description: 'Contrato enviado para firma electronica.',
          });
        } else if (data.data?.contratoWarning) {
          toast.warning('Candidato contratado — Accion pendiente', {
            description: data.data.contratoWarning,
            duration: 8000,
          });
        } else if (data.data?.warning?.tipo === 'doble_contratacion') {
          toast.warning('Candidato contratado con advertencia', {
            description: `Este candidato ya esta contratado en: ${data.data.warning.vacantes}. Verifica que esto sea intencional.`,
            duration: 8000,
          });
        } else {
          toast.success('Estado actualizado correctamente');
        }
        onEstadoCambiado?.();
      } else {
        toast.error(data.data?.error || data.error || 'Error actualizando estado');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  function handleClick(transicion: TransicionInfo) {
    if (!transicion.permitida) return;

    const key = transicion.state.key;

    if (key === 'seleccionado') {
      setOpen(false);
      setConfirmDialog({
        open: true,
        estado: 'seleccionado',
        title: 'Seleccionar candidato',
        description: `Al seleccionar a ${candidatoNombre} se enviara un email con link de documentos al candidato. ¿Confirmar?`,
      });
      return;
    }

    if (key === 'contrato_terminado') {
      setOpen(false);
      setTerminacionOpen(true);
      return;
    }

    if (key === 'contratado') {
      setOpen(false);
      setConfirmDialog({
        open: true,
        estado: 'contratado',
        title: 'Marcar como contratado',
        description: `Al marcar a ${candidatoNombre} como contratado, se generara el contrato y se enviara para firma electronica. El email de onboarding se enviara automaticamente despues de que el contrato sea firmado. ¿Confirmar?`,
      });
      return;
    }

    if (key === 'descartado') {
      setOpen(false);
      setConfirmDialog({
        open: true,
        estado: 'descartado',
        title: 'Descartar candidato',
        description: `Se enviara un email de agradecimiento a ${candidatoNombre}. ¿Confirmar?`,
      });
      return;
    }

    cambiarEstado(key);
  }

  function handleConfirm() {
    cambiarEstado(confirmDialog.estado);
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  }

  const isCompact = size === 'sm';

  return (
    <TooltipProvider delayDuration={200}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors hover:shadow-sm cursor-pointer',
              getStateBadgeColor(estadoActual),
              isCompact ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
            )}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className={cn('animate-spin', isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
            ) : null}
            {currentState?.label || estadoActual.replace(/_/g, ' ')}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-1"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
            Cambiar estado
          </div>
          <div className="space-y-0.5">
            {transiciones.map((t, idx) => {
              const isDescartado = t.state.key === 'descartado';
              const isCurrent = t.state.key === estadoActual;
              const isAutomatic = t.state.automatico;
              const isBlocked = !t.permitida && !isCurrent && !isAutomatic;

              // Separator before descartado
              if (isDescartado) {
                return (
                  <div key={t.state.key}>
                    <div className="border-t my-1" />
                    <StateRow
                      transicion={t}
                      isCurrent={isCurrent}
                      isAutomatic={!!isAutomatic}
                      isBlocked={isBlocked}
                      isCompact={isCompact}
                      onClick={() => handleClick(t)}
                    />
                  </div>
                );
              }

              return (
                <StateRow
                  key={t.state.key}
                  transicion={t}
                  isCurrent={isCurrent}
                  isAutomatic={!!isAutomatic}
                  isBlocked={isBlocked}
                  isCompact={isCompact}
                  onClick={() => handleClick(t)}
                />
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Confirmation dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(val) => setConfirmDialog((prev) => ({ ...prev, open: val }))}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={loading}
              className={cn(
                confirmDialog.estado === 'descartado'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-teal hover:bg-teal/90'
              )}
            >
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DialogTerminacionContrato
        aplicacionId={aplicacionId}
        candidatoNombre={candidatoNombre}
        vacanteTitulo=""
        open={terminacionOpen}
        onOpenChange={setTerminacionOpen}
        onTerminado={() => onEstadoCambiado?.()}
      />
    </TooltipProvider>
  );
}

function StateRow({
  transicion,
  isCurrent,
  isAutomatic,
  isBlocked,
  isCompact,
  onClick,
}: {
  transicion: TransicionInfo;
  isCurrent: boolean;
  isAutomatic: boolean;
  isBlocked: boolean;
  isCompact: boolean;
  onClick: () => void;
}) {
  const { state, permitida, razon, completado } = transicion;
  const isDescartado = state.key === 'descartado';

  const content = (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (permitida) onClick();
      }}
      disabled={!permitida}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors',
        isCurrent && 'bg-accent font-semibold cursor-default',
        permitida && !isCurrent && 'hover:bg-accent cursor-pointer',
        isBlocked && 'opacity-50 cursor-not-allowed',
        isAutomatic && !isCurrent && 'opacity-60 cursor-not-allowed',
        isDescartado && permitida && 'text-red-600 hover:bg-red-50'
      )}
    >
      {/* Left indicator */}
      <span className="shrink-0 flex items-center justify-center w-4 h-4">
        {completado && !isCurrent ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : isCurrent ? (
          <span className={cn('h-2 w-2 rounded-full', state.color)} />
        ) : isBlocked ? (
          <Lock className="h-3 w-3 text-gray-400" />
        ) : isAutomatic ? (
          <Zap className="h-3 w-3 text-gray-400" />
        ) : (
          <span className={cn('h-2 w-2 rounded-full opacity-40', state.color)} />
        )}
      </span>

      {/* Label */}
      <span className="flex-1 truncate">{state.label}</span>

      {/* Right chips */}
      {isAutomatic && !isCurrent && (
        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium shrink-0">
          Auto
        </span>
      )}
    </button>
  );

  // Wrap blocked items with tooltip showing reason
  if (isBlocked && razon) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px] text-xs">
          {razon}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
