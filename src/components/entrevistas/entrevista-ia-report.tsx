'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScoreBadge } from '@/components/candidatos/score-badge';
import { TranscripcionView } from './transcripcion-view';
import type { EntrevistaIA, EntrevistaIAAnalisis, DimensionAnalisis } from '@/lib/types/entrevista.types';
import { CheckCircle, XCircle, Clock, AlertCircle, AlertTriangle, Phone } from 'lucide-react';

interface Props {
  entrevista: EntrevistaIA;
}

const estadoConfig: Record<string, { icon: any; label: string; color: string }> = {
  pendiente: { icon: Clock, label: 'Pendiente', color: 'bg-gray-100 text-gray-700' },
  iniciando: { icon: Phone, label: 'Iniciando', color: 'bg-blue-100 text-blue-700' },
  en_curso: { icon: Phone, label: 'En curso', color: 'bg-blue-100 text-blue-700' },
  completada: { icon: CheckCircle, label: 'Completada', color: 'bg-success/10 text-success' },
  fallida: { icon: XCircle, label: 'Fallida', color: 'bg-destructive/10 text-destructive' },
  cancelada: { icon: XCircle, label: 'Cancelada', color: 'bg-destructive/10 text-destructive' },
};

const DIMENSIONES: { key: keyof Pick<EntrevistaIAAnalisis, 'competencia_tecnica' | 'motivacion' | 'conexion_cultural' | 'comunicacion' | 'tono_emocional'>; label: string }[] = [
  { key: 'competencia_tecnica', label: 'Competencia Tecnica' },
  { key: 'motivacion', label: 'Motivacion' },
  { key: 'conexion_cultural', label: 'Conexion Cultural' },
  { key: 'comunicacion', label: 'Comunicacion' },
  { key: 'tono_emocional', label: 'Tono Emocional' },
];

function DimensionBar({ dimension, label }: { dimension: DimensionAnalisis; label: string }) {
  const color = dimension.score >= 70 ? 'bg-success' : dimension.score >= 50 ? 'bg-orange' : 'bg-destructive';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Peso: {Math.round(dimension.peso * 100)}%</span>
          <span className="text-sm font-bold">{dimension.score}/100</span>
        </div>
      </div>
      <div className="w-full bg-soft-gray rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${dimension.score}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{dimension.justificacion}</p>
      {dimension.evidencia && dimension.evidencia.length > 0 && (
        <div className="pl-3 border-l-2 border-teal/30 space-y-1 mt-1">
          {dimension.evidencia.map((e, i) => (
            <p key={i} className="text-xs italic text-muted-foreground">&ldquo;{e}&rdquo;</p>
          ))}
        </div>
      )}
    </div>
  );
}

export function EntrevistaIAReport({ entrevista }: Props) {
  const estado = estadoConfig[entrevista.estado] || estadoConfig.pendiente;
  const EstadoIcon = estado.icon;
  const analisis = entrevista.analisis;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Entrevista IA</CardTitle>
            <Badge className={estado.color}>
              <EstadoIcon className="h-3 w-3 mr-1" />
              {estado.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {entrevista.candidato && (
              <div>
                <p className="text-muted-foreground">Candidato</p>
                <p className="font-medium">{entrevista.candidato.nombre}</p>
              </div>
            )}
            {entrevista.vacante && (
              <div>
                <p className="text-muted-foreground">Vacante</p>
                <p className="font-medium">{entrevista.vacante.titulo}</p>
              </div>
            )}
            {entrevista.duracion_segundos && (
              <div>
                <p className="text-muted-foreground">Duracion</p>
                <p className="font-medium">{Math.floor(entrevista.duracion_segundos / 60)}:{String(entrevista.duracion_segundos % 60).padStart(2, '0')} min</p>
              </div>
            )}
            {entrevista.score_total !== null && (
              <div>
                <p className="text-muted-foreground">Score Total</p>
                <ScoreBadge score={Number(entrevista.score_total)} size="md" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transcripcion */}
      {entrevista.transcripcion && (
        <TranscripcionView
          transcripcion={entrevista.transcripcion}
          duracionSegundos={entrevista.duracion_segundos}
        />
      )}

      {/* Analisis por dimensiones */}
      {analisis && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen del analisis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{analisis.resumen_general}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dimensiones evaluadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {DIMENSIONES.map(({ key, label }) => {
                const dim = analisis[key];
                if (!dim) return null;
                return <DimensionBar key={key} dimension={dim} label={label} />;
              })}
            </CardContent>
          </Card>

          {/* Fortalezas y Areas de mejora */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-success">Fortalezas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {(analisis.fortalezas || []).map((f, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                  {(!analisis.fortalezas || analisis.fortalezas.length === 0) && (
                    <li className="text-sm text-muted-foreground">Sin fortalezas identificadas</li>
                  )}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-orange">Areas de mejora</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {(analisis.areas_mejora || []).map((a, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-orange shrink-0 mt-0.5" />
                      {a}
                    </li>
                  ))}
                  {(!analisis.areas_mejora || analisis.areas_mejora.length === 0) && (
                    <li className="text-sm text-muted-foreground">Sin areas de mejora identificadas</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Red flags */}
          {analisis.red_flags && analisis.red_flags.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-base text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Senales de alerta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {analisis.red_flags.map((rf, i) => (
                    <li key={i} className="text-sm text-destructive">{rf}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Recomendacion */}
          {analisis.recomendacion && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Recomendacion IA</p>
                <Badge className={
                  analisis.recomendacion === 'avanzar' ? 'bg-success/15 text-success' :
                  analisis.recomendacion === 'considerar' ? 'bg-orange/15 text-orange' :
                  'bg-destructive/15 text-destructive'
                }>
                  {analisis.recomendacion === 'avanzar' ? 'Avanzar' :
                   analisis.recomendacion === 'considerar' ? 'Considerar' :
                   'No avanzar'}
                </Badge>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* No analisis state */}
      {!analisis && entrevista.estado === 'completada' && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-8">
            <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Transcripcion recibida pero analisis pendiente.</p>
            <p className="text-xs">Configure ANTHROPIC_API_KEY para analisis automatico.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
