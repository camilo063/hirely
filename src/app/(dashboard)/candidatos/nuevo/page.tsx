'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

const FUENTES = ['manual', 'portal', 'linkedin', 'referido', 'banco_talento'];
const NIVELES_EDUCATIVOS = ['Bachillerato', 'Tecnico', 'Tecnologico', 'Profesional', 'Especializacion', 'Maestria', 'Doctorado'];

export default function NuevoCandidatoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [habilidades, setHabilidades] = useState<string[]>([]);
  const [nuevaHabilidad, setNuevaHabilidad] = useState('');

  const addHabilidad = () => {
    const h = nuevaHabilidad.trim();
    if (h && !habilidades.includes(h)) {
      setHabilidades([...habilidades, h]);
      setNuevaHabilidad('');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      nombre: formData.get('nombre'),
      apellido: formData.get('apellido'),
      email: formData.get('email'),
      telefono: formData.get('telefono') || null,
      linkedin_url: formData.get('linkedin_url') || null,
      experiencia_anos: Number(formData.get('experiencia_anos') || 0),
      ubicacion: formData.get('ubicacion') || null,
      nivel_educativo: formData.get('nivel_educativo') || null,
      salario_esperado: formData.get('salario_esperado') ? Number(formData.get('salario_esperado')) : null,
      fuente: formData.get('fuente') || 'manual',
      notas: formData.get('notas') || null,
      habilidades,
    };

    try {
      const res = await fetch('/api/candidatos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success('Candidato creado exitosamente');
      router.push(`/candidatos/${data.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear candidato');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <Breadcrumbs />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Agregar candidato</h1>
        <p className="text-muted-foreground">Registra un nuevo candidato en el banco de talento</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informacion personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" name="nombre" required placeholder="Nombre del candidato" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellido">Apellido</Label>
                <Input id="apellido" name="apellido" required placeholder="Apellido del candidato" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required placeholder="correo@ejemplo.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Telefono</Label>
                <Input id="telefono" name="telefono" placeholder="+57 300 000 0000" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ubicacion">Ubicacion</Label>
                <Input id="ubicacion" name="ubicacion" placeholder="Ciudad, Pais" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                <Input id="linkedin_url" name="linkedin_url" placeholder="https://linkedin.com/in/..." />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perfil profesional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="experiencia_anos">Anos de experiencia</Label>
                <Input id="experiencia_anos" name="experiencia_anos" type="number" min={0} defaultValue={0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nivel_educativo">Nivel educativo</Label>
                <Select name="nivel_educativo">
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {NIVELES_EDUCATIVOS.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="salario_esperado">Salario esperado (COP)</Label>
                <Input id="salario_esperado" name="salario_esperado" type="number" placeholder="0" />
              </div>
            </div>

            {/* Habilidades */}
            <div className="space-y-2">
              <Label>Habilidades</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Agregar habilidad..."
                  value={nuevaHabilidad}
                  onChange={(e) => setNuevaHabilidad(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHabilidad())}
                />
                <Button type="button" variant="outline" onClick={addHabilidad} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {habilidades.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {habilidades.map((h) => (
                    <span key={h} className="inline-flex items-center gap-1 bg-teal/10 text-teal px-2.5 py-1 rounded-full text-sm font-medium">
                      {h}
                      <button type="button" onClick={() => setHabilidades(habilidades.filter((x) => x !== h))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informacion adicional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fuente">Fuente</Label>
              <Select name="fuente" defaultValue="manual">
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUENTES.map((f) => (
                    <SelectItem key={f} value={f} className="capitalize">{f.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea id="notas" name="notas" rows={3} placeholder="Notas adicionales sobre el candidato..." />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-teal hover:bg-teal/90 text-white" disabled={loading}>
            {loading ? 'Guardando...' : 'Crear candidato'}
          </Button>
        </div>
      </form>
    </div>
  );
}
