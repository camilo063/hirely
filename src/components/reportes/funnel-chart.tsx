'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { FunnelData } from '@/lib/types/reportes.types';

interface FunnelChartProps {
  data: FunnelData;
  height?: number;
}

interface FunnelTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      cantidad: number;
      porcentaje: number;
      color: string;
    };
  }>;
}

function CustomTooltip({ active, payload }: FunnelTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-navy">{d.name}</p>
      <p className="text-muted-foreground">Cantidad: <span className="font-medium text-navy">{d.cantidad}</span></p>
      <p className="text-muted-foreground">Del total: <span className="font-medium text-navy">{d.porcentaje}%</span></p>
    </div>
  );
}

export function FunnelChart({ data, height = 320 }: FunnelChartProps) {
  const chartData = data.etapas.map((e) => ({
    name: e.etapa,
    cantidad: e.cantidad,
    porcentaje: e.porcentaje,
    color: e.color,
  }));

  if (chartData.every((d) => d.cantidad === 0)) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
        Sin datos para el periodo seleccionado
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 60, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="cantidad" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, formatter: ((v?: string | number) => (Number(v) > 0 ? v : '')) as never }}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
