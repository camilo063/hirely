'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { ContratarModal } from './contratar-modal';

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

  if (!documentosCompletos) {
    return (
      <Button size="sm" disabled variant="outline" className="gap-1.5 text-muted-foreground">
        <CheckCircle className="h-4 w-4" />
        Contratar (docs pendientes)
      </Button>
    );
  }

  return (
    <>
      <Button
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="gap-1.5 bg-success hover:bg-success/90 text-white"
      >
        <CheckCircle className="h-4 w-4" />
        Contratar
      </Button>
      <ContratarModal
        aplicacionId={aplicacionId}
        candidatoNombre={candidatoNombre}
        vacanteTitulo={vacanteTitulo}
        fechaInicioTentativa={fechaInicioTentativa}
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
      />
    </>
  );
}
