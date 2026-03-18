'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Sparkles, Loader2, Check, X, Edit2, RefreshCw, Save,
} from 'lucide-react';
import type { TipoPregunta, Dificultad } from '@/lib/types/evaluacion-tecnica.types';

interface PreguntaGenerada {
  enunciado: string;
  tipo: string;
  opciones?: Array<{ id: string; texto: string; es_correcta: boolean }> | null;
  respuesta_correcta?: string | null;
  explicacion?: string | null;
  puntos: number;
  dificultad: string;
  categoria: string;
  subcategoria?: string | null;
  tiempo_estimado_segundos: number;
  tags: string[];
  _incluida?: boolean;
  _editando?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: string[];
  onSaved: () => void;
}

const TIPO_LABELS: Record<string, string> = {
  opcion_multiple: 'Opcion multiple',
  verdadero_falso: 'V/F',
  respuesta_abierta: 'Abierta',
  codigo: 'Codigo',
};

const DIFICULTAD_COLORS: Record<string, string> = {
  basico: 'bg-green-100 text-green-700',
  intermedio: 'bg-blue-100 text-blue-700',
  avanzado: 'bg-orange-100 text-orange-700',
  experto: 'bg-red-100 text-red-700',
};

export function GenerarPreguntasIAModal({ open, onOpenChange, categorias, onSaved }: Props) {
  // Config state
  const [categoria, setCategoria] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [tipos, setTipos] = useState<TipoPregunta[]>(['opcion_multiple']);
  const [dificultad, setDificultad] = useState<Dificultad>('intermedio');
  const [cantidad, setCantidad] = useState(5);
  const [puntos, setPuntos] = useState(10);
  const [cargoObjetivo, setCargoObjetivo] = useState('');
  const [idioma, setIdioma] = useState<'es' | 'en'>('es');
  const [instrucciones, setInstrucciones] = useState('');

  // Generation state
  const [generando, setGenerando] = useState(false);
  const [preguntas, setPreguntas] = useState<PreguntaGenerada[]>([]);
  const [fase, setFase] = useState<'config' | 'preview'>('config');
  const [guardando, setGuardando] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  function toggleTipo(tipo: TipoPregunta) {
    setTipos(prev => {
      if (prev.includes(tipo)) {
        return prev.length > 1 ? prev.filter(t => t !== tipo) : prev;
      }
      return [...prev, tipo];
    });
  }

  async function handleGenerar() {
    if (!categoria.trim()) {
      toast.error('Selecciona o escribe una categoria');
      return;
    }
    setGenerando(true);
    try {
      const res = await fetch('/api/evaluaciones/banco-preguntas/generar-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoria: categoria.trim(),
          subcategoria: subcategoria.trim() || undefined,
          tipos,
          dificultad,
          cantidad,
          puntos_por_pregunta: puntos,
          cargo_objetivo: cargoObjetivo.trim() || undefined,
          idioma,
          instrucciones_adicionales: instrucciones.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.preguntas) {
        const pregs = data.data.preguntas.map((p: PreguntaGenerada) => ({
          ...p,
          _incluida: true,
          _editando: false,
        }));
        setPreguntas(pregs);
        setFase('preview');
        toast.success(`${pregs.length} preguntas generadas`);
      } else {
        toast.error(data.error || 'Error generando preguntas');
      }
    } catch {
      toast.error('Error de conexion con la IA');
    } finally {
      setGenerando(false);
    }
  }

  function toggleIncluir(index: number) {
    setPreguntas(prev => prev.map((p, i) =>
      i === index ? { ...p, _incluida: !p._incluida } : p
    ));
  }

  function updatePregunta(index: number, field: string, value: unknown) {
    setPreguntas(prev => prev.map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    ));
  }

  async function handleGuardar() {
    const seleccionadas = preguntas.filter(p => p._incluida);
    if (seleccionadas.length === 0) {
      toast.error('Selecciona al menos una pregunta');
      return;
    }

    setGuardando(true);
    try {
      const preguntasLimpias = seleccionadas.map(p => ({
        categoria: p.categoria,
        subcategoria: p.subcategoria || null,
        tipo: p.tipo,
        dificultad: p.dificultad,
        enunciado: p.enunciado,
        opciones: p.opciones || null,
        respuesta_correcta: p.respuesta_correcta || null,
        explicacion: p.explicacion || null,
        puntos: p.puntos,
        tiempo_estimado_segundos: p.tiempo_estimado_segundos,
        tags: p.tags,
        es_estandar: true,
      }));

      const res = await fetch('/api/evaluaciones/banco-preguntas/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preguntas: preguntasLimpias }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.data.importadas} preguntas guardadas en el banco`);
        onSaved();
        handleReset();
        onOpenChange(false);
      } else {
        toast.error(data.error || 'Error guardando');
      }
    } catch {
      toast.error('Error de red');
    } finally {
      setGuardando(false);
    }
  }

  function handleReset() {
    setFase('config');
    setPreguntas([]);
    setEditIndex(null);
  }

  function handleRegenerar() {
    setPreguntas([]);
    setFase('config');
    handleGenerar();
  }

  const incluidasCount = preguntas.filter(p => p._incluida).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Generar Preguntas con IA
          </SheetTitle>
        </SheetHeader>

        {fase === 'config' && (
          <div className="space-y-4 mt-4">
            {/* Categoria */}
            <div>
              <Label>Categoria</Label>
              <Input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ej: JavaScript, Marketing, Medicina, Derecho..."
                required
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Campo abierto. Escribe cualquier area de conocimiento, industria o tecnologia.
                {categorias.length > 0 && (
                  <span> Categorias existentes en tu banco: <strong>{categorias.join(', ')}</strong></span>
                )}
              </p>
            </div>

            {/* Subcategoria */}
            <div>
              <Label>Subcategoria (opcional)</Label>
              <Input
                value={subcategoria}
                onChange={(e) => setSubcategoria(e.target.value)}
                placeholder="Ej: React Hooks, SQL JOINs, Legislacion laboral..."
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Opcional. Especifica un tema mas puntual dentro de la categoria para preguntas mas enfocadas.
              </p>
            </div>

            {/* Tipos */}
            <div>
              <Label>Tipo(s) de pregunta</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(['opcion_multiple', 'verdadero_falso', 'respuesta_abierta', 'codigo'] as TipoPregunta[]).map(t => (
                  <Badge
                    key={t}
                    variant={tipos.includes(t) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleTipo(t)}
                  >
                    {TIPO_LABELS[t]}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Dificultad */}
            <div>
              <Label>Dificultad</Label>
              <select
                value={dificultad}
                onChange={(e) => setDificultad(e.target.value as Dificultad)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white mt-1"
              >
                <option value="basico">Basico</option>
                <option value="intermedio">Intermedio</option>
                <option value="avanzado">Avanzado</option>
                <option value="experto">Experto</option>
              </select>
            </div>

            {/* Cantidad + Puntos */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cantidad (1-10)</Label>
                <Input
                  type="number"
                  value={cantidad}
                  onChange={(e) => setCantidad(Math.max(1, Math.min(10, Number(e.target.value))))}
                  min={1} max={10}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Puntos por pregunta</Label>
                <Input
                  type="number"
                  value={puntos}
                  onChange={(e) => setPuntos(Number(e.target.value))}
                  min={1}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Cargo objetivo */}
            <div>
              <Label>Cargo objetivo (opcional)</Label>
              <Input
                value={cargoObjetivo}
                onChange={(e) => setCargoObjetivo(e.target.value)}
                placeholder="Frontend Developer Senior"
                className="mt-1"
              />
            </div>

            {/* Idioma */}
            <div>
              <Label>Idioma</Label>
              <select
                value={idioma}
                onChange={(e) => setIdioma(e.target.value as 'es' | 'en')}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white mt-1"
              >
                <option value="es">Espanol</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Instrucciones adicionales */}
            <div>
              <Label>Instrucciones adicionales (opcional)</Label>
              <Textarea
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                placeholder="Ej: Enfocate en hooks de React 18, evita preguntas de sintaxis basica"
                rows={3}
                className="mt-1"
              />
            </div>

            <Button
              onClick={handleGenerar}
              disabled={generando || !categoria.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 gap-2"
            >
              {generando ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generando preguntas con IA...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generar Preguntas</>
              )}
            </Button>
          </div>
        )}

        {fase === 'preview' && (
          <div className="mt-4 space-y-4">
            {/* Summary bar */}
            <div className="flex items-center justify-between bg-soft-gray/50 rounded-lg p-3">
              <span className="text-sm">
                <strong>{incluidasCount}</strong> de {preguntas.length} seleccionadas
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRegenerar} className="gap-1">
                  <RefreshCw className="h-3 w-3" /> Regenerar
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Volver a config
                </Button>
              </div>
            </div>

            {/* Question cards */}
            {preguntas.map((p, i) => (
              <div
                key={i}
                className={`border rounded-lg p-4 transition-colors ${
                  p._incluida ? 'bg-white border-green-200' : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                {editIndex === i ? (
                  // Inline edit
                  <div className="space-y-3">
                    <Textarea
                      value={p.enunciado}
                      onChange={(e) => updatePregunta(i, 'enunciado', e.target.value)}
                      rows={3}
                    />
                    {p.tipo === 'opcion_multiple' && p.opciones && (
                      <div className="space-y-1">
                        {p.opciones.map((op, oi) => (
                          <div key={op.id} className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={op.es_correcta}
                              onChange={() => {
                                const updated = p.opciones!.map((o, j) => ({
                                  ...o,
                                  es_correcta: j === oi,
                                }));
                                updatePregunta(i, 'opciones', updated);
                              }}
                              className="accent-teal"
                            />
                            <span className="text-sm font-medium w-5">{op.id})</span>
                            <Input
                              value={op.texto}
                              onChange={(e) => {
                                const updated = [...p.opciones!];
                                updated[oi] = { ...updated[oi], texto: e.target.value };
                                updatePregunta(i, 'opciones', updated);
                              }}
                              className="flex-1"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <Textarea
                      value={p.explicacion || ''}
                      onChange={(e) => updatePregunta(i, 'explicacion', e.target.value)}
                      placeholder="Explicacion..."
                      rows={2}
                    />
                    <Button size="sm" onClick={() => setEditIndex(null)} className="gap-1">
                      <Check className="h-3 w-3" /> Listo
                    </Button>
                  </div>
                ) : (
                  // Display mode
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium flex-1">{i + 1}. {p.enunciado}</p>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => setEditIndex(i)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className={`h-7 w-7 p-0 ${p._incluida ? 'text-green-600' : 'text-gray-400'}`}
                          onClick={() => toggleIncluir(i)}
                        >
                          {p._incluida ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>

                    {/* Options preview */}
                    {p.tipo === 'opcion_multiple' && p.opciones && (
                      <div className="mt-2 space-y-1">
                        {p.opciones.map(op => (
                          <div
                            key={op.id}
                            className={`text-xs px-2 py-1 rounded ${
                              op.es_correcta ? 'bg-green-50 text-green-700 font-medium' : 'text-muted-foreground'
                            }`}
                          >
                            {op.id}) {op.texto} {op.es_correcta && '(correcta)'}
                          </div>
                        ))}
                      </div>
                    )}

                    {p.tipo === 'verdadero_falso' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Respuesta: <strong>{p.respuesta_correcta}</strong>
                      </p>
                    )}

                    {p.explicacion && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        {p.explicacion}
                      </p>
                    )}

                    <div className="flex gap-1 mt-2">
                      <Badge variant="outline" className="text-[10px]">{TIPO_LABELS[p.tipo] || p.tipo}</Badge>
                      <Badge className={`${DIFICULTAD_COLORS[p.dificultad] || ''} text-[10px]`}>{p.dificultad}</Badge>
                      <Badge variant="outline" className="text-[10px]">{p.puntos} pts</Badge>
                      {p.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Save button */}
            <Button
              onClick={handleGuardar}
              disabled={guardando || incluidasCount === 0}
              className="w-full bg-teal hover:bg-teal/90 gap-2"
            >
              {guardando ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
              ) : (
                <><Save className="h-4 w-4" /> Guardar {incluidasCount} pregunta(s) al banco</>
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
