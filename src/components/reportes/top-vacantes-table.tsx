'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { TopVacante } from '@/lib/types/reportes.types';

interface TopVacantesTableProps {
  data: TopVacante[];
}

function ConversionBadge({ valor }: { valor: number }) {
  const color = valor >= 10 ? 'bg-emerald-50 text-emerald-700' : valor >= 5 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', color)}>{valor}%</span>;
}

function ScoreBadge({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-muted-foreground text-xs">&mdash;</span>;
  const color = valor >= 80 ? 'bg-emerald-50 text-emerald-700' : valor >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', color)}>{valor}</span>;
}

export function TopVacantesTable({ data }: TopVacantesTableProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-sm py-10">
        Sin vacantes disponibles
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Vacante</th>
            <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Aplicaciones</th>
            <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Contratados</th>
            <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Conversion</th>
            <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Score Prom.</th>
            <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Dias</th>
          </tr>
        </thead>
        <tbody>
          {data.map((v) => (
            <tr key={v.vacanteId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="py-2.5 px-3">
                <Link href={`/vacantes/${v.vacanteId}`} className="text-teal hover:underline font-medium">
                  {v.titulo}
                </Link>
              </td>
              <td className="text-right py-2.5 px-3 font-medium text-navy">{v.totalAplicaciones}</td>
              <td className="text-right py-2.5 px-3 font-medium text-navy">{v.contratados}</td>
              <td className="text-right py-2.5 px-3"><ConversionBadge valor={v.tasaConversion} /></td>
              <td className="text-right py-2.5 px-3"><ScoreBadge valor={v.scorePromedio} /></td>
              <td className="text-right py-2.5 px-3 text-muted-foreground">{Math.round(v.diasAbierta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
