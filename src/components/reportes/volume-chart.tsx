'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { VolumenSemana } from '@/lib/types/reportes.types';

interface VolumeChartProps {
  data: VolumenSemana[];
  height?: number;
}

interface VolumeTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: VolumeTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-navy mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-medium text-navy">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function VolumeChart({ data, height = 280 }: VolumeChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
        Sin datos para el periodo seleccionado
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.semanaLabel.split(' – ')[0],
    Aplicaciones: d.totalAplicaciones,
    Contratados: d.contratados,
    Descartados: d.descartados,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Aplicaciones" fill="#d1d5db" radius={[2, 2, 0, 0]} />
        <Line type="monotone" dataKey="Contratados" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Descartados" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
