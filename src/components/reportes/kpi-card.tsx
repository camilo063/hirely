'use client';

import { cn } from '@/lib/utils';

interface KPICardProps {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  tendencia?: {
    valor: number;
    label: string;
  };
  icono?: React.ReactNode;
  color?: 'default' | 'success' | 'warning' | 'danger';
}

const colorClasses = {
  default: 'bg-white border-gray-200',
  success: 'bg-white border-emerald-200',
  warning: 'bg-white border-amber-200',
  danger: 'bg-white border-red-200',
};

const iconBgClasses = {
  default: 'bg-gray-100 text-gray-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
};

export function KPICard({ titulo, valor, subtitulo, tendencia, icono, color = 'default' }: KPICardProps) {
  return (
    <div className={cn('rounded-xl border p-5 transition-shadow hover:shadow-md', colorClasses[color])}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
          <p className="text-2xl font-bold text-navy">{valor}</p>
          {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
          {tendencia && (
            <p className={cn('text-xs font-medium', tendencia.valor >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {tendencia.valor >= 0 ? '+' : ''}{tendencia.valor}% {tendencia.label}
            </p>
          )}
        </div>
        {icono && (
          <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', iconBgClasses[color])}>
            {icono}
          </div>
        )}
      </div>
    </div>
  );
}
