'use client';

import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import {
  ESTADOS_TERMINALES,
  UMBRAL_ESTANCAMIENTO_DIAS,
  diasEnEstadoActual,
} from '@/lib/constants/pipeline-states';

interface EstancamientoBadgeProps {
  estado: string;
  estadoUpdatedAt: string | null;
}

export function EstancamientoBadge({ estado, estadoUpdatedAt }: EstancamientoBadgeProps) {
  if (ESTADOS_TERMINALES.includes(estado)) return null;

  const dias = diasEnEstadoActual(estadoUpdatedAt);
  if (dias === null || dias <= UMBRAL_ESTANCAMIENTO_DIAS) return null;

  return (
    <Badge variant="outline" className="text-xs gap-1 whitespace-nowrap text-orange-700 border-orange-300 bg-orange-50">
      <AlertTriangle className="h-3 w-3" /> Estancado: {dias}d
    </Badge>
  );
}
