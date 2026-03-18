'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MONEDAS, JORNADAS } from '@/lib/utils/constants';
import { useTiposContrato } from '@/hooks/useTiposContrato';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

interface ContratoGeneratorProps {
  aplicacionId: string;
  candidatoId: string;
  vacanteId: string;
  candidatoNombre: string;
  vacanteTitulo: string;
  onSuccess?: (contratoId: string) => void;
}

export function ContratoGenerator({
  aplicacionId, candidatoId, vacanteId,
  candidatoNombre, vacanteTitulo, onSuccess,
}: ContratoGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [beneficios, setBeneficios] = useState<string[]>([]);
  const [nuevoBeneficio, setNuevoBeneficio] = useState('');
  const { tipos: tiposContrato } = useTiposContrato();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aplicacion_id: aplicacionId,
          candidato_id: candidatoId,
          vacante_id: vacanteId,
          datos: {
            nombre_completo: formData.get('nombre_completo'),
            documento_identidad: formData.get('documento_identidad'),
            cargo: formData.get('cargo') || vacanteTitulo,
            departamento: formData.get('departamento'),
            fecha_inicio: formData.get('fecha_inicio'),
            salario: Number(formData.get('salario')),
            moneda: formData.get('moneda') || 'COP',
            tipo_contrato: formData.get('tipo_contrato'),
            jornada: formData.get('jornada'),
            beneficios,
            clausulas_adicionales: [],
          },
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      toast.success('Contrato generado exitosamente');
      onSuccess?.(data.data.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar contrato');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos del contrato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input name="nombre_completo" defaultValue={candidatoNombre} required />
            </div>
            <div className="space-y-2">
              <Label>Documento de identidad</Label>
              <Input name="documento_identidad" required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input name="cargo" defaultValue={vacanteTitulo} required />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Input name="departamento" required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <Input name="fecha_inicio" type="date" required />
            </div>
            <div className="space-y-2">
              <Label>Salario</Label>
              <Input name="salario" type="number" required />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select name="moneda" defaultValue="COP">
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
              <Label>Tipo de contrato</Label>
              <Select name="tipo_contrato">
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {tiposContrato.map((t) => (
                    <SelectItem key={t.slug} value={t.slug}>{t.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Jornada</Label>
              <Select name="jornada">
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {JORNADAS.map((j) => (
                    <SelectItem key={j} value={j}>{j}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Beneficios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Agregar beneficio..."
              value={nuevoBeneficio}
              onChange={(e) => setNuevoBeneficio(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (nuevoBeneficio.trim()) {
                    setBeneficios([...beneficios, nuevoBeneficio.trim()]);
                    setNuevoBeneficio('');
                  }
                }
              }}
            />
            <Button type="button" variant="outline" onClick={() => {
              if (nuevoBeneficio.trim()) {
                setBeneficios([...beneficios, nuevoBeneficio.trim()]);
                setNuevoBeneficio('');
              }
            }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {beneficios.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-teal/10 text-teal px-2 py-1 rounded-full text-sm">
                {b}
                <button type="button" onClick={() => setBeneficios(beneficios.filter((_, idx) => idx !== i))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" className="bg-teal hover:bg-teal/90 text-white" disabled={loading}>
          {loading ? 'Generando...' : 'Generar contrato'}
        </Button>
      </div>
    </form>
  );
}
