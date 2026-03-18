'use client';

import { Check, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { ScoreBreakdown as ScoreBreakdownType } from '@/lib/types/scoring.types';

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdownType;
  scoreTotal: number;
}

const DIMENSION_LABELS: Record<string, string> = {
  experiencia: 'Experiencia Relevante',
  habilidades: 'Habilidades Tecnicas',
  educacion: 'Educacion',
  idiomas: 'Idiomas',
  certificaciones: 'Certificaciones',
  keywords: 'Keywords',
};

/**
 * Muestra el desglose del score ATS por dimension.
 * Cada dimension tiene:
 * - Barra de progreso con color semaforo
 * - Score/100 + peso
 * - Lista de matches y gaps
 */
export function ScoreBreakdown({ breakdown, scoreTotal }: ScoreBreakdownProps) {
  const dimensions = Object.entries(breakdown) as [keyof ScoreBreakdownType, ScoreBreakdownType[keyof ScoreBreakdownType]][];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy">Desglose del Score ATS</h3>
        <span className="text-2xl font-bold text-navy">{scoreTotal}<span className="text-sm text-muted-foreground">/100</span></span>
      </div>

      {dimensions.map(([key, dim]) => (
        <div key={key} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{DIMENSION_LABELS[key] || key}</span>
            <span className="text-muted-foreground">
              {dim.score}/100 x {Math.round(dim.peso * 100)}% = <strong>{dim.ponderado}pts</strong>
            </span>
          </div>

          <Progress
            value={dim.score}
            className="h-2"
          />

          <p className="text-xs text-muted-foreground">{dim.detalle}</p>

          {(dim.matches.length > 0 || dim.gaps.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-1">
              {dim.matches.map((m, i) => (
                <Badge key={`m-${i}`} variant="outline" className="text-xs text-success border-success/30 gap-1">
                  <Check className="h-3 w-3" />{m}
                </Badge>
              ))}
              {dim.gaps.map((g, i) => (
                <Badge key={`g-${i}`} variant="outline" className="text-xs text-red-500 border-red-200 gap-1">
                  <X className="h-3 w-3" />{g}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
