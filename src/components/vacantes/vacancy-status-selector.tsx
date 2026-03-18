'use client';

import { useState } from 'react';
import { ChevronDown, Linkedin, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { LinkedInPublishModal } from '@/components/vacantes/linkedin-publish-modal';
import { cn } from '@/lib/utils';
import {
  getValidTransitions,
  isTerminalState,
  type VacancyEstado,
  type StateTransition,
} from '@/lib/services/vacancy-state-machine';
import type { LinkedInPublishResult } from '@/lib/types/linkedin.types';
import { toast } from 'sonner';

const estadoStyles: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  publicada: 'bg-success/10 text-success',
  pausada: 'bg-yellow-100 text-yellow-700',
  cerrada: 'bg-orange/10 text-orange',
  archivada: 'bg-gray-100 text-gray-500',
};

const estadoLabels: Record<string, string> = {
  borrador: 'Borrador',
  publicada: 'Publicada',
  pausada: 'Pausada',
  cerrada: 'Cerrada',
  archivada: 'Archivada',
};

interface VacancyStatusSelectorProps {
  vacanteId: string;
  currentEstado: VacancyEstado;
  onEstadoChange: (newEstado: VacancyEstado) => void;
}

export function VacancyStatusSelector({
  vacanteId,
  currentEstado,
  onEstadoChange,
}: VacancyStatusSelectorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [confirmTransition, setConfirmTransition] = useState<StateTransition | null>(null);
  const [showDeeplinkModal, setShowDeeplinkModal] = useState(false);
  const [deeplinkResult, setDeeplinkResult] = useState<LinkedInPublishResult | null>(null);

  const transitions = getValidTransitions(currentEstado);
  const terminal = isTerminalState(currentEstado);

  async function executeTransition(transition: StateTransition) {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/vacantes/${vacanteId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: transition.to }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || 'Error al cambiar estado');
        return;
      }

      // LinkedIn publish failed — estado was NOT changed
      if (data.data?.linkedinError) {
        toast.error(data.data.linkedinError, {
          duration: 8000,
          description: 'La vacante no cambio de estado.',
        });
        return;
      }

      if (data.data?.warning) {
        toast.warning(data.data.warning);
      }

      // Handle deeplink modal for publish actions
      if (data.data?.linkedin?.mode === 'deeplink' && data.data?.linkedin?.deepLinkUrl) {
        setDeeplinkResult(data.data.linkedin);
        setShowDeeplinkModal(true);
      } else if (transition.linkedinAction === 'publish' && data.data?.linkedin?.success) {
        toast.success('Estado actualizado y publicado en LinkedIn');
      } else {
        toast.success(`Vacante ${estadoLabels[transition.to].toLowerCase()}`);
      }

      onEstadoChange(transition.to);
    } catch {
      toast.error('Error de conexion al cambiar estado');
    } finally {
      setIsLoading(false);
    }
  }

  function handleTransitionClick(transition: StateTransition) {
    if (transition.requiresConfirmation) {
      setConfirmTransition(transition);
    } else {
      executeTransition(transition);
    }
  }

  function handleConfirm() {
    if (confirmTransition) {
      executeTransition(confirmTransition);
      setConfirmTransition(null);
    }
  }

  // Terminal state: plain badge, no dropdown
  if (terminal || transitions.length === 0) {
    return (
      <Badge className={cn('capitalize text-sm', estadoStyles[currentEstado])}>
        {estadoLabels[currentEstado] || currentEstado}
      </Badge>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isLoading}>
          <button
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
              'transition-colors cursor-pointer hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal',
              estadoStyles[currentEstado]
            )}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {estadoLabels[currentEstado] || currentEstado}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {transitions.map((t) => (
            <DropdownMenuItem
              key={t.to}
              onClick={() => handleTransitionClick(t)}
              className={cn(
                'cursor-pointer gap-2',
                t.destructive && 'text-destructive focus:text-destructive'
              )}
            >
              {t.linkedinAction !== 'none' && (
                <Linkedin className="h-4 w-4 text-[#0A66C2]" />
              )}
              {t.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {confirmTransition && (
        <ConfirmDialog
          open={!!confirmTransition}
          onOpenChange={(open) => { if (!open) setConfirmTransition(null); }}
          title={confirmTransition.confirmTitle || 'Confirmar'}
          description={confirmTransition.confirmMessage || 'Deseas continuar?'}
          confirmLabel={confirmTransition.label}
          onConfirm={handleConfirm}
          destructive={confirmTransition.destructive}
        />
      )}

      {showDeeplinkModal && deeplinkResult && (
        <LinkedInPublishModal
          isOpen={showDeeplinkModal}
          onClose={() => setShowDeeplinkModal(false)}
          result={deeplinkResult}
        />
      )}
    </>
  );
}
