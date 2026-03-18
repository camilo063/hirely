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

interface ScoresChartProps {
  data: { rango: string; candidatos: number; label: string }[];
  height?: number;
}

const RANGE_COLORS: Record<string, string> = {
  '0-20': '#ef4444',
  '21-40': '#f97316',
  '41-60': '#f59e0b',
  '61-80': '#84cc16',
  '81-100': '#10B981',
};

interface ScoresTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: { rango: string; candidatos: number; label: string };
  }>;
}

function CustomTooltip({ active, payload }: ScoresTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-navy">{d.label} ({d.rango})</p>
      <p className="text-muted-foreground">Candidatos: <span className="font-medium text-navy">{d.candidatos}</span></p>
    </div>
  );
}

export function ScoresChart({ data, height = 240 }: ScoresChartProps) {
  if (data.every((d) => d.candidatos === 0)) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
        Sin datos de scores disponibles
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="rango" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="candidatos" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={RANGE_COLORS[entry.rango] || '#6366f1'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
