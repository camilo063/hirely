'use client';

import { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { EvaluacionHumana } from '@/lib/types/entrevista.types';

interface Props {
  entrevistaHumanaId: string;
  candidatoNombre: string;
  vacanteTitulo: string;
  onSaved?: (result: any) => void;
}

const CRITERIOS = [
  { key: 'competencia_tecnica', label: 'Competencia Tecnica', description: 'Profundidad y precision en conocimientos tecnicos' },
  { key: 'habilidades_blandas', label: 'Habilidades Blandas', description: 'Comunicacion, trabajo en equipo, liderazgo' },
  { key: 'fit_cultural', label: 'Fit Cultural', description: 'Afinidad con valores y cultura de la empresa' },
  { key: 'potencial_crecimiento', label: 'Potencial de Crecimiento', description: 'Capacidad de aprendizaje y desarrollo' },
  { key: 'presentacion_personal', label: 'Presentacion Personal', description: 'Profesionalismo, puntualidad, actitud' },
] as const;

export function EvaluacionHumanaForm({ entrevistaHumanaId, candidatoNombre, vacanteTitulo, onSaved }: Props) {
  const [scores, setScores] = useState<Record<string, number>>({
    competencia_tecnica: 5,
    habilidades_blandas: 5,
    fit_cultural: 5,
    potencial_crecimiento: 5,
    presentacion_personal: 5,
  });
  const [observaciones, setObservaciones] = useState<Record<string, string>>({});
  const [observacionGeneral, setObservacionGeneral] = useState('');
  const [recomendacion, setRecomendacion] = useState<'contratar' | 'considerar' | 'no_contratar'>('considerar');
  const [loading, setLoading] = useState(false);

  const promedio = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const evaluacion: EvaluacionHumana = {
        competencia_tecnica: { score: scores.competencia_tecnica, observacion: observaciones.competencia_tecnica || '' },
        habilidades_blandas: { score: scores.habilidades_blandas, observacion: observaciones.habilidades_blandas || '' },
        fit_cultural: { score: scores.fit_cultural, observacion: observaciones.fit_cultural || '' },
        potencial_crecimiento: { score: scores.potencial_crecimiento, observacion: observaciones.potencial_crecimiento || '' },
        presentacion_personal: { score: scores.presentacion_personal, observacion: observaciones.presentacion_personal || '' },
        observaciones_generales: observacionGeneral,
        recomendacion,
        evaluated_at: new Date().toISOString(),
      };

      const res = await fetch(`/api/entrevistas/${entrevistaHumanaId}/evaluacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evaluacion),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Evaluacion guardada', {
          description: `Score dual calculado: ${data.data.score_final}/100`,
        });
        onSaved?.(data.data);
      } else {
        toast.error('Error al guardar evaluacion');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border">
      <div>
        <h2 className="text-lg font-semibold text-navy">Evaluacion de Entrevista</h2>
        <p className="text-sm text-muted-foreground">{candidatoNombre} — {vacanteTitulo}</p>
      </div>

      {CRITERIOS.map(({ key, label, description }) => (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">{label}</span>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Badge variant="outline" className="text-lg font-bold min-w-[3rem] justify-center">
              {scores[key]}/10
            </Badge>
          </div>
          <Slider
            value={[scores[key]]}
            onValueChange={([v]) => setScores(prev => ({ ...prev, [key]: v }))}
            min={1}
            max={10}
            step={1}
            className="w-full"
          />
          <Textarea
            placeholder={`Observaciones sobre ${label.toLowerCase()}...`}
            value={observaciones[key] || ''}
            onChange={(e) => setObservaciones(prev => ({ ...prev, [key]: e.target.value }))}
            rows={2}
            className="text-sm"
          />
        </div>
      ))}

      <div className="flex items-center justify-between p-3 bg-light-bg rounded-lg">
        <span className="font-medium">Promedio</span>
        <span className="text-2xl font-bold text-navy">{promedio.toFixed(1)}/10</span>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Recomendacion</label>
        <div className="flex gap-2">
          {([
            { value: 'contratar' as const, label: 'Contratar', color: 'bg-success/15 text-success border-success/30' },
            { value: 'considerar' as const, label: 'Considerar', color: 'bg-orange/15 text-orange border-orange/30' },
            { value: 'no_contratar' as const, label: 'No contratar', color: 'bg-red-100 text-red-600 border-red-200' },
          ]).map(opt => (
            <Badge
              key={opt.value}
              variant="outline"
              className={`cursor-pointer px-4 py-2 ${recomendacion === opt.value ? opt.color + ' ring-2 ring-offset-1' : 'opacity-50'}`}
              onClick={() => setRecomendacion(opt.value)}
            >
              {opt.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Observaciones Generales</label>
        <Textarea
          placeholder="Impresion general del candidato, aspectos destacados, preocupaciones..."
          value={observacionGeneral}
          onChange={(e) => setObservacionGeneral(e.target.value)}
          rows={4}
        />
      </div>

      <Button onClick={handleSubmit} disabled={loading} className="w-full gap-2 bg-navy hover:bg-navy/90">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {loading ? 'Guardando...' : 'Guardar Evaluacion y Calcular Score Dual'}
      </Button>
    </div>
  );
}
