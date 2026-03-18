'use client';

import { ClipboardList, Bot, User, Timer } from 'lucide-react';
import type { TiemposPorEtapa } from '@/lib/types/reportes.types';

interface TimeMetricsProps {
  tiempos: TiemposPorEtapa;
}

function MetricRow({
  icono,
  label,
  valor,
}: {
  icono: React.ReactNode;
  label: string;
  valor: number | null;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
          {icono}
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold text-navy">
        {valor !== null ? `${valor} dias` : (
          <span className="text-muted-foreground font-normal" title="Sin datos suficientes">&mdash;</span>
        )}
      </span>
    </div>
  );
}

export function TimeMetrics({ tiempos }: TimeMetricsProps) {
  return (
    <div className="space-y-0 divide-y divide-gray-100">
      <MetricRow
        icono={<ClipboardList className="h-4 w-4" />}
        label="Aplicacion → Entrevista IA"
        valor={tiempos.diasAplicacionAEntrevistaIa}
      />
      <MetricRow
        icono={<Bot className="h-4 w-4" />}
        label="Entrevista IA → Humana"
        valor={tiempos.diasEntrevistaIaAHumana}
      />
      <MetricRow
        icono={<User className="h-4 w-4" />}
        label="Humana → Evaluacion"
        valor={tiempos.diasHumanaAEvaluacion}
      />
      <div className="border-t-2 border-gray-200 !mt-1 !pt-1">
        <MetricRow
          icono={<Timer className="h-4 w-4" />}
          label="Tiempo total de contratacion"
          valor={tiempos.diasTotalContratacion}
        />
      </div>
    </div>
  );
}
