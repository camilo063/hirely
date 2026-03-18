'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Check, Plus, Trash2, RefreshCw, Send,
} from 'lucide-react';
import type {
  EvaluacionPlantilla, EstructuraPlantilla, PreguntaAsignada, CategoriaConteo, Dificultad,
} from '@/lib/types/evaluacion-tecnica.types';

const DIFICULTAD_COLORS: Record<string, string> = {
  basico: 'bg-green-100 text-green-700',
  intermedio: 'bg-blue-100 text-blue-700',
  avanzado: 'bg-orange-100 text-orange-700',
  experto: 'bg-red-100 text-red-700',
};

interface Vacante { id: string; titulo: string; }
interface Aplicacion { id: string; candidato_id: string; candidato_nombre: string; candidato_apellido?: string; email: string; estado: string; }

export default function NuevaEvaluacionPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1
  const [vacantes, setVacantes] = useState<Vacante[]>([]);
  const [plantillas, setPlantillas] = useState<EvaluacionPlantilla[]>([]);
  const [categorias, setCategorias] = useState<CategoriaConteo[]>([]);
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([]);
  const [selectedVacante, setSelectedVacante] = useState('');
  const [selectedAplicacion, setSelectedAplicacion] = useState('');
  const [selectedPlantilla, setSelectedPlantilla] = useState('');

  // Step 2
  const [titulo, setTitulo] = useState('');
  const [duracion, setDuracion] = useState(60);
  const [puntajeAprobatorio, setPuntajeAprobatorio] = useState(70);
  const [estructura, setEstructura] = useState<EstructuraPlantilla[]>([
    { categoria: '', cantidad: 5, dificultad: 'intermedio', puntos_por_pregunta: 10 },
  ]);

  // Step 3
  const [previewPreguntas, setPreviewPreguntas] = useState<PreguntaAsignada[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchVacantes();
    fetchPlantillas();
    fetchCategorias();
  }, []);

  useEffect(() => {
    if (selectedVacante) fetchAplicaciones(selectedVacante);
  }, [selectedVacante]);

  useEffect(() => {
    if (selectedPlantilla) {
      const p = plantillas.find(pl => pl.id === selectedPlantilla);
      if (p) {
        const est = typeof p.estructura === 'string' ? JSON.parse(p.estructura) : p.estructura;
        setEstructura(est);
        setDuracion(p.duracion_minutos);
        setPuntajeAprobatorio(p.puntaje_aprobatorio);
      }
    }
  }, [selectedPlantilla, plantillas]);

  useEffect(() => {
    if (selectedVacante) {
      const v = vacantes.find(vac => vac.id === selectedVacante);
      if (v && !titulo) setTitulo(`Evaluación Técnica — ${v.titulo}`);
    }
  }, [selectedVacante, vacantes, titulo]);

  async function fetchVacantes() {
    const res = await fetch('/api/vacantes');
    const data = await res.json();
    if (data.success) setVacantes(data.data?.data || data.data || []);
  }

  async function fetchPlantillas() {
    const res = await fetch('/api/evaluaciones/plantillas');
    const data = await res.json();
    if (data.success) setPlantillas(data.data || []);
  }

  async function fetchCategorias() {
    const res = await fetch('/api/evaluaciones/banco-preguntas/categorias');
    const data = await res.json();
    if (data.success) setCategorias(data.data || []);
  }

  async function fetchAplicaciones(vacanteId: string) {
    try {
      const res = await fetch(`/api/vacantes/${vacanteId}/candidatos`);
      const data = await res.json();
      if (data.success) {
        const apps = (data.data || []).map((a: any) => {
          const c = typeof a.candidato === 'string' ? JSON.parse(a.candidato) : a.candidato;
          return {
            id: a.id,
            candidato_id: c?.id || a.candidato_id,
            candidato_nombre: c?.nombre || '',
            candidato_apellido: c?.apellido || '',
            email: c?.email || '',
            estado: a.estado,
          };
        });
        setAplicaciones(apps);
      }
    } catch { /* ignore */ }
  }

  async function generatePreview() {
    setLoadingPreview(true);
    try {
      // Use the API to create a temporary evaluation with estructura to get preview
      const res = await fetch('/api/evaluaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aplicacion_id: selectedAplicacion,
          candidato_id: aplicaciones.find(a => a.id === selectedAplicacion)?.candidato_id,
          vacante_id: selectedVacante,
          plantilla_id: selectedPlantilla || null,
          titulo,
          duracion_minutos: duracion,
          puntaje_aprobatorio: puntajeAprobatorio,
          estructura: estructura.filter(e => e.categoria),
        }),
      });
      const data = await res.json();
      if (data.success) {
        const pregs = typeof data.data.preguntas === 'string' ? JSON.parse(data.data.preguntas) : data.data.preguntas;
        setPreviewPreguntas(pregs);
        // Store the created evaluation ID for sending
        setCreatedEvalId(data.data.id);
      } else {
        toast.error(data.error || 'Error generando preview');
      }
    } catch {
      toast.error('Error generando preview');
    } finally {
      setLoadingPreview(false);
    }
  }

  const [createdEvalId, setCreatedEvalId] = useState<string | null>(null);

  async function handleCreateAndSend() {
    if (!createdEvalId) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/evaluaciones/${createdEvalId}/enviar`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Evaluación creada y enviada');
        router.push('/evaluaciones');
      } else {
        toast.error(data.error || 'Error enviando');
      }
    } catch {
      toast.error('Error');
    } finally {
      setCreating(false);
    }
  }

  function handleCreateOnly() {
    if (createdEvalId) {
      toast.success('Evaluación creada (pendiente de envío)');
      router.push('/evaluaciones');
    }
  }

  function updateEstructura(index: number, field: keyof EstructuraPlantilla, value: string | number) {
    const updated = [...estructura];
    (updated[index] as any)[field] = value;
    setEstructura(updated);
  }

  const totalPreguntas = estructura.reduce((s, e) => s + e.cantidad, 0);
  const totalPuntos = estructura.reduce((s, e) => s + e.cantidad * e.puntos_por_pregunta, 0);
  const selectedApp = aplicaciones.find(a => a.id === selectedAplicacion);

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <Breadcrumbs />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Nueva Evaluación Técnica</h1>
        <p className="text-muted-foreground">Paso {step} de 3</p>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-teal' : 'bg-gray-200'}`} />
        ))}
      </div>

      {/* Step 1: Seleccionar candidato y vacante */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seleccionar candidato y vacante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Vacante</Label>
              <select
                value={selectedVacante}
                onChange={(e) => { setSelectedVacante(e.target.value); setSelectedAplicacion(''); setTitulo(''); }}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white mt-1"
              >
                <option value="">Seleccionar vacante...</option>
                {vacantes.map(v => <option key={v.id} value={v.id}>{v.titulo}</option>)}
              </select>
            </div>

            {selectedVacante && (
              <div>
                <Label>Candidato</Label>
                <select
                  value={selectedAplicacion}
                  onChange={(e) => setSelectedAplicacion(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white mt-1"
                >
                  <option value="">Seleccionar candidato...</option>
                  {aplicaciones.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.candidato_nombre} {a.candidato_apellido} — {a.email} ({a.estado})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label>Usar plantilla (opcional)</Label>
              {plantillas.length > 0 ? (
                <select
                  value={selectedPlantilla}
                  onChange={(e) => setSelectedPlantilla(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white mt-1"
                >
                  <option value="">Armar ad-hoc...</option>
                  {plantillas.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} — {p.duracion_minutos}min, aprueba {p.puntaje_aprobatorio}%</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  No hay plantillas creadas.{' '}
                  <a href="/evaluaciones/plantillas" className="text-teal hover:underline">
                    Crear una plantilla
                  </a>{' '}
                  para pre-llenar la configuracion automaticamente.
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedVacante || !selectedAplicacion}
                className="bg-teal hover:bg-teal/90 gap-1"
              >
                Siguiente <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Configurar evaluación */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configurar evaluación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duración (minutos)</Label>
                <Input type="number" value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} min={5} className="mt-1" />
              </div>
              <div>
                <Label>Puntaje aprobatorio (%)</Label>
                <Input type="number" value={puntajeAprobatorio} onChange={(e) => setPuntajeAprobatorio(Number(e.target.value))} min={1} max={100} className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Estructura de preguntas</Label>
              <div className="space-y-2 mt-2">
                {estructura.map((item, i) => {
                  const catInfo = categorias.find(c => c.categoria === item.categoria);
                  return (
                    <div key={i} className="flex items-center gap-2 p-2 bg-soft-gray/50 rounded-lg">
                      <Input
                        value={item.categoria}
                        onChange={(e) => updateEstructura(i, 'categoria', e.target.value)}
                        list="cats-list-wizard"
                        placeholder="Categoría"
                        className="flex-1"
                        required
                      />
                      <Input
                        type="number"
                        value={item.cantidad}
                        onChange={(e) => updateEstructura(i, 'cantidad', Number(e.target.value))}
                        min={1}
                        className="w-16"
                        title="Cantidad"
                      />
                      <select
                        value={item.dificultad}
                        onChange={(e) => updateEstructura(i, 'dificultad', e.target.value)}
                        className="border rounded px-2 py-1 text-xs bg-white"
                      >
                        <option value="basico">Básico</option>
                        <option value="intermedio">Intermedio</option>
                        <option value="avanzado">Avanzado</option>
                        <option value="experto">Experto</option>
                        <option value="mixta">Mixta</option>
                      </select>
                      <Input
                        type="number"
                        value={item.puntos_por_pregunta}
                        onChange={(e) => updateEstructura(i, 'puntos_por_pregunta', Number(e.target.value))}
                        min={1}
                        className="w-16"
                        title="Puntos"
                      />
                      {estructura.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEstructura(estructura.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </Button>
                      )}
                      {catInfo && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {catInfo.total} disp.
                        </span>
                      )}
                    </div>
                  );
                })}
                <datalist id="cats-list-wizard">
                  {categorias.map(c => <option key={c.categoria} value={c.categoria} />)}
                </datalist>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEstructura([...estructura, { categoria: '', cantidad: 3, dificultad: 'intermedio', puntos_por_pregunta: 10 }])}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" /> Agregar categoría
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Total: {totalPreguntas} preguntas, {totalPuntos} puntos
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button
                onClick={() => { setStep(3); generatePreview(); }}
                disabled={estructura.every(e => !e.categoria)}
                className="bg-teal hover:bg-teal/90 gap-1"
              >
                Preview <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview y enviar */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview y enviar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-soft-gray/50 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-navy">{previewPreguntas.length}</p>
                  <p className="text-xs text-muted-foreground">Preguntas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-navy">{duracion}</p>
                  <p className="text-xs text-muted-foreground">Minutos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-navy">{totalPuntos}</p>
                  <p className="text-xs text-muted-foreground">Puntos total</p>
                </div>
              </div>
              {selectedApp && (
                <p className="text-sm text-center mt-3 text-muted-foreground">
                  Para: <strong>{selectedApp.candidato_nombre} {selectedApp.candidato_apellido}</strong>
                </p>
              )}
            </div>

            {loadingPreview ? (
              <div className="text-center py-8 text-muted-foreground">Seleccionando preguntas...</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {previewPreguntas.map((p, i) => (
                  <div key={p.pregunta_id} className="flex items-start gap-3 p-3 bg-white border rounded-lg">
                    <span className="text-xs font-medium text-muted-foreground mt-0.5">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="text-sm line-clamp-2">{p.enunciado}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{p.categoria}</Badge>
                        <Badge className={`${DIFICULTAD_COLORS[p.dificultad]} text-[10px]`}>{p.dificultad}</Badge>
                        <span className="text-[10px] text-muted-foreground">{p.puntos} pts</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => { setStep(2); setCreatedEvalId(null); }} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Anterior
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCreateOnly} disabled={!createdEvalId || creating}>
                  <Check className="h-4 w-4 mr-1" />
                  Crear (enviar después)
                </Button>
                <Button
                  onClick={handleCreateAndSend}
                  disabled={!createdEvalId || creating}
                  className="bg-teal hover:bg-teal/90 gap-1"
                >
                  <Send className="h-4 w-4" />
                  {creating ? 'Enviando...' : 'Crear y Enviar'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
