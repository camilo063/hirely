'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Link2, Info } from 'lucide-react';

interface Mapeo {
  id: string;
  tipo_contrato_slug: string;
  plantilla_id: string;
  plantilla_nombre: string;
}

interface TipoOption {
  slug: string;
  nombre: string;
}

interface PlantillaOption {
  id: string;
  nombre: string;
  tipo: string;
}

export function TipoPlantillaMapeo() {
  const [mapeos, setMapeos] = useState<Mapeo[]>([]);
  const [tipos, setTipos] = useState<TipoOption[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newTipo, setNewTipo] = useState('');
  const [newPlantilla, setNewPlantilla] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracion/tipo-plantilla-mapeo');
      const json = await res.json();
      console.log('[TipoPlantillaMapeo] API response:', JSON.stringify(json).substring(0, 500));
      const d = json.data || json;
      setMapeos(d.mapeos || []);
      setTipos(d.tipos || []);
      setPlantillas(d.plantillas || []);
    } catch {
      toast.error('Error cargando mapeos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!newTipo || !newPlantilla) {
      toast.error('Selecciona tipo de contrato y plantilla');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/configuracion/tipo-plantilla-mapeo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_contrato_slug: newTipo, plantilla_id: newPlantilla }),
      });
      if (!res.ok) throw new Error();
      toast.success('Mapeo guardado');
      setNewTipo('');
      setNewPlantilla('');
      setShowAdd(false);
      fetchData();
    } catch {
      toast.error('Error al guardar mapeo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (mapeo: Mapeo) => {
    try {
      const res = await fetch(`/api/configuracion/tipo-plantilla-mapeo?id=${mapeo.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Mapeo eliminado');
      fetchData();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  // Tipos que aun no tienen mapeo
  const tiposSinMapeo = tipos.filter(t => !mapeos.some(m => m.tipo_contrato_slug === t.slug));

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm py-4"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800">
          Define que plantilla se usa automaticamente para cada tipo de contrato.
          Cuando un candidato es contratado, el sistema buscara aqui que plantilla aplicar segun el tipo de contrato de la vacante.
        </p>
      </div>

      {/* Existing mappings */}
      {mapeos.length > 0 ? (
        <div className="space-y-2">
          {mapeos.map(mapeo => {
            const tipoInfo = tipos.find(t => t.slug === mapeo.tipo_contrato_slug);
            return (
              <div key={mapeo.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs font-medium">
                    {tipoInfo?.nombre || mapeo.tipo_contrato_slug}
                  </Badge>
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{mapeo.plantilla_nombre}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(mapeo)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-3">
          No hay mapeos configurados. Los contratos se generaran con la plantilla por defecto.
        </p>
      )}

      {/* Add new mapping */}
      {showAdd ? (
        <div className="border border-dashed border-teal rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de contrato</label>
              <Select value={newTipo} onValueChange={setNewTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map(t => (
                    <SelectItem key={t.slug} value={t.slug}>
                      {t.nombre}
                      {mapeos.some(m => m.tipo_contrato_slug === t.slug) ? ' (actualizar)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Plantilla a usar</label>
              <Select value={newPlantilla} onValueChange={setNewPlantilla}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plantilla..." />
                </SelectTrigger>
                <SelectContent>
                  {plantillas.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setNewTipo(''); setNewPlantilla(''); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={saving || !newTipo || !newPlantilla} className="bg-teal hover:bg-teal/90 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Guardar mapeo
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Agregar mapeo
        </Button>
      )}
    </div>
  );
}
