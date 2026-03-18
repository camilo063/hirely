'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_CRITERIOS } from '@/lib/types/scoring.types';
import type { CriteriosEvaluacion } from '@/lib/types/scoring.types';

const DIMENSION_LABELS: Record<keyof CriteriosEvaluacion, string> = {
  experiencia: 'Experiencia Relevante',
  habilidades: 'Habilidades Tecnicas',
  educacion: 'Educacion',
  idiomas: 'Idiomas',
  certificaciones: 'Certificaciones',
  keywords: 'Keywords',
};

const DIMENSION_DESCRIPTIONS: Record<keyof CriteriosEvaluacion, string> = {
  experiencia: 'Anos y calidad de experiencia en roles similares',
  habilidades: 'Match de habilidades tecnicas requeridas',
  educacion: 'Formacion academica y nivel de estudios',
  idiomas: 'Dominio de idiomas requeridos',
  certificaciones: 'Certificaciones profesionales relevantes',
  keywords: 'Terminos clave del CV vs. la vacante',
};

interface CriteriosExtended extends CriteriosEvaluacion {
  idiomas_requeridos?: string[];
  certificaciones_requeridas?: string[];
  keywords_requeridos?: string[];
}

interface CriteriosPonderacionProps {
  criterios: CriteriosExtended | any[];
  onChange: (criterios: CriteriosExtended) => void;
  scoreMinimo?: number;
  onScoreMinimoChange?: (value: number) => void;
}

export function CriteriosPonderacion({
  criterios,
  onChange,
  scoreMinimo = 70,
  onScoreMinimoChange,
}: CriteriosPonderacionProps) {
  // Normalize from old array format or flat object
  const normalized = normalizeCriterios(criterios);

  const [idiomasInput, setIdiomasInput] = useState('');
  const [certsInput, setCertsInput] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');

  const totalPercent = Math.round(
    (normalized.experiencia + normalized.habilidades + normalized.educacion +
     normalized.idiomas + normalized.certificaciones + normalized.keywords) * 100
  );
  const isValid = totalPercent >= 99 && totalPercent <= 101; // Allow rounding

  function handleSliderChange(dimension: keyof CriteriosEvaluacion, newPercent: number) {
    const newValue = newPercent / 100;
    const updated = { ...normalized, [dimension]: newValue };
    onChange(updated);
  }

  function handleResetDefaults() {
    onChange({
      ...DEFAULT_CRITERIOS,
      idiomas_requeridos: normalized.idiomas_requeridos || [],
      certificaciones_requeridas: normalized.certificaciones_requeridas || [],
      keywords_requeridos: normalized.keywords_requeridos || [],
    });
  }

  function addTag(field: 'idiomas_requeridos' | 'certificaciones_requeridas' | 'keywords_requeridos', value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const current = normalized[field] || [];
    if (!current.includes(trimmed)) {
      onChange({ ...normalized, [field]: [...current, trimmed] });
    }
  }

  function removeTag(field: 'idiomas_requeridos' | 'certificaciones_requeridas' | 'keywords_requeridos', value: string) {
    onChange({ ...normalized, [field]: (normalized[field] || []).filter((t: string) => t !== value) });
  }

  const dimensions = Object.keys(DIMENSION_LABELS) as (keyof CriteriosEvaluacion)[];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Criterios de Evaluacion ATS</CardTitle>
          <div className="flex items-center gap-2">
            <div className={cn(
              'text-sm font-medium px-3 py-1 rounded-full',
              isValid ? 'bg-success/10 text-success' : 'bg-orange/10 text-orange'
            )}>
              Total: {totalPercent}%
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={handleResetDefaults} className="text-xs">
              <RotateCcw className="h-3 w-3 mr-1" /> Defaults
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Dimension sliders */}
        {dimensions.map((dim) => {
          const percent = Math.round(normalized[dim] * 100);
          return (
            <div key={dim} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{DIMENSION_LABELS[dim]}</Label>
                <span className="text-sm font-bold text-navy">{percent}%</span>
              </div>
              <Slider
                value={[percent]}
                min={0}
                max={60}
                step={5}
                onValueChange={([v]) => handleSliderChange(dim, v)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">{DIMENSION_DESCRIPTIONS[dim]}</p>
            </div>
          );
        })}

        {/* Score minimo slider */}
        {onScoreMinimoChange && (
          <div className="pt-4 border-t space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Filtro de corte</Label>
              <span className="text-sm font-bold text-navy">{scoreMinimo}</span>
            </div>
            <Slider
              value={[scoreMinimo]}
              min={0}
              max={100}
              step={5}
              onValueChange={([v]) => onScoreMinimoChange(v)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Solo candidatos con score &ge; {scoreMinimo} pasaran automaticamente a revision
            </p>
          </div>
        )}

        {/* Tag inputs */}
        <div className="pt-4 border-t space-y-4">
          {/* Idiomas requeridos */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Idiomas requeridos</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ej: Ingles"
                value={idiomasInput}
                onChange={(e) => setIdiomasInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag('idiomas_requeridos', idiomasInput);
                    setIdiomasInput('');
                  }
                }}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => { addTag('idiomas_requeridos', idiomasInput); setIdiomasInput(''); }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(normalized.idiomas_requeridos || []).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button type="button" onClick={() => removeTag('idiomas_requeridos', tag)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Certificaciones requeridas */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Certificaciones requeridas</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ej: PMP, AWS Solutions Architect"
                value={certsInput}
                onChange={(e) => setCertsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag('certificaciones_requeridas', certsInput);
                    setCertsInput('');
                  }
                }}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => { addTag('certificaciones_requeridas', certsInput); setCertsInput(''); }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(normalized.certificaciones_requeridas || []).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button type="button" onClick={() => removeTag('certificaciones_requeridas', tag)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Keywords requeridos */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Keywords requeridos</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ej: agile, microservicios, scrum"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag('keywords_requeridos', keywordsInput);
                    setKeywordsInput('');
                  }
                }}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => { addTag('keywords_requeridos', keywordsInput); setKeywordsInput(''); }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(normalized.keywords_requeridos || []).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button type="button" onClick={() => removeTag('keywords_requeridos', tag)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Normalizes criterios from old array format to new flat object format.
 */
function normalizeCriterios(criterios: any): CriteriosExtended {
  if (Array.isArray(criterios)) {
    // Old format: [{nombre, peso, descripcion}]
    const result: CriteriosExtended = { ...DEFAULT_CRITERIOS };
    for (const c of criterios) {
      const name = (c.nombre || '').toLowerCase();
      if (name.includes('experiencia')) result.experiencia = c.peso / 100;
      else if (name.includes('habilidad') || name.includes('tecnic')) result.habilidades = c.peso / 100;
      else if (name.includes('educacion') || name.includes('educación')) result.educacion = c.peso / 100;
      else if (name.includes('idioma')) result.idiomas = c.peso / 100;
      else if (name.includes('certificacion') || name.includes('certificación')) result.certificaciones = c.peso / 100;
      else if (name.includes('keyword') || name.includes('cultura')) result.keywords = c.peso / 100;
    }
    return result;
  }

  if (criterios && typeof criterios === 'object') {
    return {
      experiencia: criterios.experiencia ?? DEFAULT_CRITERIOS.experiencia,
      habilidades: criterios.habilidades ?? DEFAULT_CRITERIOS.habilidades,
      educacion: criterios.educacion ?? DEFAULT_CRITERIOS.educacion,
      idiomas: criterios.idiomas ?? DEFAULT_CRITERIOS.idiomas,
      certificaciones: criterios.certificaciones ?? DEFAULT_CRITERIOS.certificaciones,
      keywords: criterios.keywords ?? DEFAULT_CRITERIOS.keywords,
      idiomas_requeridos: criterios.idiomas_requeridos || [],
      certificaciones_requeridas: criterios.certificaciones_requeridas || [],
      keywords_requeridos: criterios.keywords_requeridos || [],
    };
  }

  return { ...DEFAULT_CRITERIOS };
}
