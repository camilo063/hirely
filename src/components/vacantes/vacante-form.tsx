'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CriteriosPonderacion } from './criterios-ponderacion';
import { DEPARTAMENTOS, MONEDAS, MODALIDADES } from '@/lib/utils/constants';
import { useTiposContrato } from '@/hooks/useTiposContrato';
import { DEFAULT_CRITERIOS } from '@/lib/types/scoring.types';
import type { CriteriosEvaluacion } from '@/lib/types/scoring.types';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

interface VacanteFormProps {
  initialData?: Record<string, unknown>;
  isEditing?: boolean;
}

export function VacanteForm({ initialData, isEditing = false }: VacanteFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { tipos: tiposContrato } = useTiposContrato();
  const [criterios, setCriterios] = useState<any>(
    (initialData?.criterios_evaluacion as any) || { ...DEFAULT_CRITERIOS }
  );
  const [scoreMinimo, setScoreMinimo] = useState<number>(
    (initialData?.score_minimo as number) || 70
  );
  const [habilidades, setHabilidades] = useState<string[]>(
    (initialData?.habilidades_requeridas as string[]) || []
  );
  const [nuevaHabilidad, setNuevaHabilidad] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      titulo: formData.get('titulo'),
      descripcion: formData.get('descripcion'),
      departamento: formData.get('departamento'),
      ubicacion: formData.get('ubicacion'),
      tipo_contrato: formData.get('tipo_contrato'),
      modalidad: formData.get('modalidad') || 'remoto',
      rango_salarial_min: formData.get('rango_salarial_min') ? Number(formData.get('rango_salarial_min')) : null,
      rango_salarial_max: formData.get('rango_salarial_max') ? Number(formData.get('rango_salarial_max')) : null,
      moneda: formData.get('moneda') || 'COP',
      experiencia_minima: Number(formData.get('experiencia_minima') || 0),
      criterios_evaluacion: criterios,
      habilidades_requeridas: habilidades,
      score_minimo: scoreMinimo,
    };

    try {
      const url = isEditing ? `/api/vacantes/${initialData?.id}` : '/api/vacantes';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      toast.success(isEditing ? 'Vacante actualizada' : 'Vacante creada exitosamente');
      router.push(`/vacantes/${data.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const addHabilidad = () => {
    if (nuevaHabilidad.trim() && !habilidades.includes(nuevaHabilidad.trim())) {
      setHabilidades([...habilidades, nuevaHabilidad.trim()]);
      setNuevaHabilidad('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informacion basica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Titulo de la vacante</Label>
            <Input id="titulo" name="titulo" defaultValue={initialData?.titulo as string} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripcion</Label>
            <Textarea id="descripcion" name="descripcion" rows={5} defaultValue={initialData?.descripcion as string} required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="departamento">Departamento</Label>
              <Select name="departamento" defaultValue={(initialData?.departamento as string) || ''}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {DEPARTAMENTOS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ubicacion">Ubicacion</Label>
              <Input id="ubicacion" name="ubicacion" defaultValue={initialData?.ubicacion as string} required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo_contrato">Tipo de contrato</Label>
              <Select name="tipo_contrato" defaultValue={(initialData?.tipo_contrato as string) || ''}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {tiposContrato.map((t) => (
                    <SelectItem key={t.slug} value={t.slug}>{t.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modalidad">Modalidad</Label>
              <Select name="modalidad" defaultValue={(initialData?.modalidad as string) || 'remoto'}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {MODALIDADES.map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="experiencia_minima">Experiencia minima (anos)</Label>
              <Input id="experiencia_minima" name="experiencia_minima" type="number" min={0}
                defaultValue={initialData?.experiencia_minima as number || 0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="moneda">Moneda</Label>
              <Select name="moneda" defaultValue={(initialData?.moneda as string) || 'COP'}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONEDAS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rango_salarial_min">Salario minimo</Label>
              <Input id="rango_salarial_min" name="rango_salarial_min" type="number"
                defaultValue={initialData?.rango_salarial_min as number} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rango_salarial_max">Salario maximo</Label>
              <Input id="rango_salarial_max" name="rango_salarial_max" type="number"
                defaultValue={initialData?.rango_salarial_max as number} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Habilidades requeridas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Agregar habilidad..."
              value={nuevaHabilidad}
              onChange={(e) => setNuevaHabilidad(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHabilidad())}
            />
            <Button type="button" variant="outline" onClick={addHabilidad}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {habilidades.map((h) => (
              <span key={h} className="inline-flex items-center gap-1 bg-teal/10 text-teal px-2 py-1 rounded-full text-sm">
                {h}
                <button type="button" onClick={() => setHabilidades(habilidades.filter((x) => x !== h))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <CriteriosPonderacion
        criterios={criterios}
        onChange={setCriterios}
        scoreMinimo={scoreMinimo}
        onScoreMinimoChange={setScoreMinimo}
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" className="bg-teal hover:bg-teal/90 text-white" disabled={loading}>
          {loading ? 'Guardando...' : isEditing ? 'Actualizar vacante' : 'Crear vacante'}
        </Button>
      </div>
    </form>
  );
}
