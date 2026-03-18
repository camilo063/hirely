'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import type { PreguntaBanco, OpcionPregunta, TipoPregunta, Dificultad } from '@/lib/types/evaluacion-tecnica.types';

interface Props {
  pregunta: PreguntaBanco | null;
  categorias: string[];
  onSaved: () => void;
  onCancel: () => void;
}

export function PreguntaForm({ pregunta, categorias, onSaved, onCancel }: Props) {
  const [tipo, setTipo] = useState<TipoPregunta>(pregunta?.tipo || 'opcion_multiple');
  const [categoria, setCategoria] = useState(pregunta?.categoria || '');
  const [subcategoria, setSubcategoria] = useState(pregunta?.subcategoria || '');
  const [dificultad, setDificultad] = useState<Dificultad>(pregunta?.dificultad || 'intermedio');
  const [enunciado, setEnunciado] = useState(pregunta?.enunciado || '');
  const [opciones, setOpciones] = useState<OpcionPregunta[]>(
    pregunta?.opciones || [
      { id: 'a', texto: '', es_correcta: true },
      { id: 'b', texto: '', es_correcta: false },
      { id: 'c', texto: '', es_correcta: false },
      { id: 'd', texto: '', es_correcta: false },
    ]
  );
  const [respuestaCorrecta, setRespuestaCorrecta] = useState(pregunta?.respuesta_correcta || 'verdadero');
  const [explicacion, setExplicacion] = useState(pregunta?.explicacion || '');
  const [puntos, setPuntos] = useState(pregunta?.puntos || 10);
  const [tiempoEstimado, setTiempoEstimado] = useState(pregunta?.tiempo_estimado_segundos || 120);
  const [tags, setTags] = useState(pregunta?.tags?.join(', ') || '');
  const [esEstandar, setEsEstandar] = useState(pregunta?.es_estandar ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const data: Record<string, unknown> = {
      tipo,
      categoria: categoria.trim(),
      subcategoria: subcategoria.trim() || null,
      dificultad,
      enunciado: enunciado.trim(),
      explicacion: explicacion.trim() || null,
      puntos,
      tiempo_estimado_segundos: tiempoEstimado,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      es_estandar: esEstandar,
      cargos_aplicables: [],
    };

    if (tipo === 'opcion_multiple') {
      data.opciones = opciones;
      data.respuesta_correcta = null;
    } else if (tipo === 'verdadero_falso') {
      data.opciones = null;
      data.respuesta_correcta = respuestaCorrecta;
    } else {
      data.opciones = null;
      data.respuesta_correcta = respuestaCorrecta || null;
    }

    try {
      const url = pregunta
        ? `/api/evaluaciones/banco-preguntas/${pregunta.id}`
        : '/api/evaluaciones/banco-preguntas';
      const method = pregunta ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(pregunta ? 'Pregunta actualizada' : 'Pregunta creada');
        onSaved();
      } else {
        toast.error(result.error || 'Error guardando pregunta');
      }
    } catch {
      toast.error('Error de red');
    } finally {
      setSaving(false);
    }
  }

  function updateOpcion(index: number, field: keyof OpcionPregunta, value: string | boolean) {
    const updated = [...opciones];
    if (field === 'es_correcta' && value === true) {
      updated.forEach(o => o.es_correcta = false);
    }
    (updated[index] as any)[field] = value;
    setOpciones(updated);
  }

  function addOpcion() {
    const nextId = String.fromCharCode(97 + opciones.length); // a, b, c, d, e, f
    setOpciones([...opciones, { id: nextId, texto: '', es_correcta: false }]);
  }

  function removeOpcion(index: number) {
    if (opciones.length <= 2) return;
    setOpciones(opciones.filter((_, i) => i !== index));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tipo */}
      <div>
        <Label>Tipo de pregunta</Label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoPregunta)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white mt-1"
        >
          <option value="opcion_multiple">Opción múltiple</option>
          <option value="verdadero_falso">Verdadero / Falso</option>
          <option value="respuesta_abierta">Respuesta abierta</option>
          <option value="codigo">Código</option>
        </select>
      </div>

      {/* Categoría + Dificultad */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Categoría</Label>
          <Input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            list="categorias-list"
            placeholder="JavaScript, React, SQL..."
            required
            className="mt-1"
          />
          <datalist id="categorias-list">
            {categorias.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <Label>Dificultad</Label>
          <select
            value={dificultad}
            onChange={(e) => setDificultad(e.target.value as Dificultad)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white mt-1"
          >
            <option value="basico">Básico</option>
            <option value="intermedio">Intermedio</option>
            <option value="avanzado">Avanzado</option>
            <option value="experto">Experto</option>
          </select>
        </div>
      </div>

      {/* Subcategoría */}
      <div>
        <Label>Subcategoría (opcional)</Label>
        <Input
          value={subcategoria}
          onChange={(e) => setSubcategoria(e.target.value)}
          placeholder="Closures, Hooks, JOINs..."
          className="mt-1"
        />
      </div>

      {/* Enunciado */}
      <div>
        <Label>Enunciado</Label>
        <Textarea
          value={enunciado}
          onChange={(e) => setEnunciado(e.target.value)}
          placeholder="Escribe la pregunta..."
          required
          rows={4}
          className="mt-1"
        />
      </div>

      {/* Opciones (opción múltiple) */}
      {tipo === 'opcion_multiple' && (
        <div>
          <Label>Opciones</Label>
          <div className="space-y-2 mt-1">
            {opciones.map((op, i) => (
              <div key={op.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correcta"
                  checked={op.es_correcta}
                  onChange={() => updateOpcion(i, 'es_correcta', true)}
                  className="accent-teal"
                />
                <span className="text-sm font-medium w-6">{op.id})</span>
                <Input
                  value={op.texto}
                  onChange={(e) => updateOpcion(i, 'texto', e.target.value)}
                  placeholder={`Opción ${op.id}`}
                  required
                  className="flex-1"
                />
                {opciones.length > 2 && (
                  <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeOpcion(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                )}
              </div>
            ))}
            {opciones.length < 6 && (
              <Button type="button" variant="outline" size="sm" onClick={addOpcion} className="gap-1">
                <Plus className="h-3 w-3" /> Agregar opción
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Selecciona el radio de la respuesta correcta</p>
        </div>
      )}

      {/* V/F */}
      {tipo === 'verdadero_falso' && (
        <div>
          <Label>Respuesta correcta</Label>
          <div className="flex gap-4 mt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="verdadero" checked={respuestaCorrecta === 'verdadero'} onChange={() => setRespuestaCorrecta('verdadero')} className="accent-teal" />
              Verdadero
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="falso" checked={respuestaCorrecta === 'falso'} onChange={() => setRespuestaCorrecta('falso')} className="accent-teal" />
              Falso
            </label>
          </div>
        </div>
      )}

      {/* Abierta/Código: guía de evaluación */}
      {(tipo === 'respuesta_abierta' || tipo === 'codigo') && (
        <div>
          <Label>Guía de evaluación (para IA o evaluador)</Label>
          <Textarea
            value={respuestaCorrecta}
            onChange={(e) => setRespuestaCorrecta(e.target.value)}
            placeholder="Describe qué se espera como respuesta correcta..."
            rows={3}
            className="mt-1"
          />
        </div>
      )}

      {/* Explicación */}
      <div>
        <Label>Explicación (opcional, mostrada post-evaluación)</Label>
        <Textarea
          value={explicacion}
          onChange={(e) => setExplicacion(e.target.value)}
          placeholder="Por qué esta es la respuesta correcta..."
          rows={2}
          className="mt-1"
        />
      </div>

      {/* Puntos + Tiempo */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Puntos</Label>
          <Input type="number" value={puntos} onChange={(e) => setPuntos(Number(e.target.value))} min={1} max={100} className="mt-1" />
        </div>
        <div>
          <Label>Tiempo estimado (seg)</Label>
          <Input type="number" value={tiempoEstimado} onChange={(e) => setTiempoEstimado(Number(e.target.value))} min={10} max={3600} className="mt-1" />
        </div>
      </div>

      {/* Tags */}
      <div>
        <Label>Tags (separados por coma)</Label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="senior, frontend, react-native" className="mt-1" />
      </div>

      {/* Estándar */}
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={esEstandar} onChange={(e) => setEsEstandar(e.target.checked)} className="accent-teal" />
        <Label className="cursor-pointer">Pregunta estándar (aplica a múltiples cargos)</Label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="bg-teal hover:bg-teal/90" disabled={saving}>
          {saving ? 'Guardando...' : pregunta ? 'Actualizar' : 'Crear Pregunta'}
        </Button>
      </div>
    </form>
  );
}
