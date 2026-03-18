'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScoreBadge } from '@/components/candidatos/score-badge';
import { AlertTriangle } from 'lucide-react';

interface CandidatoScore {
  id: string;
  nombre: string;
  apellido?: string;
  email: string;
  aplicacion_id: string;
  score_ats: number | null;
  score_ia: number | null;
  score_humano: number | null;
  score_tecnico: number | null;
  score_final: number | null;
  discrepancia: number;
  estado: string;
  analisis_ia?: any;
  evaluacion_humana?: any;
  eval_tecnica_aprobada?: boolean | null;
}

interface Props {
  candidatos: CandidatoScore[];
  onSelectCandidato?: (candidato: CandidatoScore) => void;
  selectedId?: string;
}

export function ScoringDualDashboard({ candidatos, onSelectCandidato, selectedId }: Props) {
  if (candidatos.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground py-8">
          <p className="text-sm">No hay candidatos con scores IA o Humano para esta vacante.</p>
          <p className="text-xs mt-1">Los scores aparecen cuando se completan entrevistas IA o evaluaciones humanas.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total evaluados</p>
            <p className="text-2xl font-bold text-navy">{candidatos.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Promedio Score Final</p>
            <p className="text-2xl font-bold text-navy">
              {Math.round(candidatos.filter(c => c.score_final).reduce((a, c) => a + (Number(c.score_final) || 0), 0) / (candidatos.filter(c => c.score_final).length || 1))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Con Score IA</p>
            <p className="text-2xl font-bold text-teal">{candidatos.filter(c => c.score_ia !== null).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Alertas discrepancia</p>
            <p className="text-2xl font-bold text-destructive">{candidatos.filter(c => Number(c.discrepancia) > 30).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativa Scoring Dual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium">Candidato</th>
                  <th className="pb-2 pr-4 font-medium text-center">Score ATS</th>
                  <th className="pb-2 pr-4 font-medium text-center">Score IA</th>
                  <th className="pb-2 pr-4 font-medium text-center">Score Humano</th>
                  <th className="pb-2 pr-4 font-medium text-center">Score Técnico</th>
                  <th className="pb-2 pr-4 font-medium text-center">Score Final</th>
                  <th className="pb-2 pr-4 font-medium text-center">Discrepancia</th>
                  <th className="pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {candidatos.map((c) => {
                  const disc = Number(c.discrepancia);
                  const alertDisc = disc > 30;

                  return (
                    <tr
                      key={c.id}
                      className={`border-b last:border-0 cursor-pointer hover:bg-soft-gray/50 transition-colors ${selectedId === c.id ? 'bg-teal/5' : ''}`}
                      onClick={() => onSelectCandidato?.(c)}
                    >
                      <td className="py-3 pr-4">
                        <p className="font-medium text-navy">{c.nombre} {c.apellido || ''}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </td>
                      <td className="py-3 pr-4 text-center">
                        {c.score_ats !== null ? <ScoreBadge score={Number(c.score_ats)} size="sm" /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-center">
                        {c.score_ia !== null ? <ScoreBadge score={Number(c.score_ia)} size="sm" /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-center">
                        {c.score_humano !== null ? <ScoreBadge score={Number(c.score_humano)} size="sm" /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-center">
                        {c.score_tecnico !== null ? (
                          <div className="flex items-center justify-center gap-1">
                            <ScoreBadge score={Number(c.score_tecnico)} size="sm" />
                            {c.eval_tecnica_aprobada !== null && (
                              <span className={`text-[10px] ${c.eval_tecnica_aprobada ? 'text-green-600' : 'text-red-500'}`}>
                                {c.eval_tecnica_aprobada ? '✓' : '✗'}
                              </span>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-center">
                        {c.score_final !== null ? <ScoreBadge score={Number(c.score_final)} size="sm" /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {alertDisc && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                          <span className={alertDisc ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                            {c.score_ia !== null && c.score_humano !== null ? disc : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        <Badge variant="outline" className="capitalize text-xs">{c.estado}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
