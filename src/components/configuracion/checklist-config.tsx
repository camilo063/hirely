'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, GripVertical, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import type { DocumentoChecklist } from '@/lib/types/seleccion.types';
import { CHECKLIST_DOCUMENTOS_DEFAULT } from '@/lib/types/seleccion.types';

export function ChecklistConfig() {
  const [checklist, setChecklist] = useState<DocumentoChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchChecklist();
  }, []);

  async function fetchChecklist() {
    try {
      const res = await fetch('/api/configuracion/checklist');
      const data = await res.json();
      if (data.success) {
        setChecklist(data.data || []);
      }
    } catch {
      toast.error('Error cargando checklist');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/configuracion/checklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Checklist guardado');
      } else {
        toast.error(data.error || 'Error guardando');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setSaving(false);
    }
  }

  function handleRestoreDefaults() {
    setChecklist([...CHECKLIST_DOCUMENTOS_DEFAULT]);
    toast.info('Checklist restaurado a valores por defecto. Guarda para aplicar.');
  }

  function handleAdd() {
    setChecklist([
      ...checklist,
      { tipo: `doc_${Date.now()}`, label: '', requerido: false },
    ]);
  }

  function handleRemove(index: number) {
    setChecklist(checklist.filter((_, i) => i !== index));
  }

  function handleUpdate(index: number, field: keyof DocumentoChecklist, value: unknown) {
    setChecklist(checklist.map((item, i) => {
      if (i !== index) return item;
      return { ...item, [field]: value };
    }));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-teal" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Documentos requeridos</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRestoreDefaults} className="gap-1">
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar
            </Button>
            <Button variant="outline" size="sm" onClick={handleAdd} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Configura los documentos que se solicitan al candidato seleccionado.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checklist.map((item, index) => (
            <div key={index} className="flex items-start gap-2 border rounded-lg p-3">
              <GripVertical className="h-4 w-4 text-gray-300 mt-2.5 shrink-0 cursor-grab" />
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    value={item.label}
                    onChange={(e) => handleUpdate(index, 'label', e.target.value)}
                    placeholder="Ej: Cedula de ciudadania"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Descripcion</Label>
                  <Input
                    value={item.descripcion || ''}
                    onChange={(e) => handleUpdate(index, 'descripcion', e.target.value || undefined)}
                    placeholder="Instrucciones..."
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap">
                    <Checkbox
                      checked={item.requerido}
                      onCheckedChange={(v: boolean | 'indeterminate') => handleUpdate(index, 'requerido', !!v)}
                    />
                    Obligatorio
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-red-400 hover:text-red-500"
                    onClick={() => handleRemove(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {checklist.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-4">
            No hay documentos configurados. Agrega uno o restaura los valores por defecto.
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-teal hover:bg-teal/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar checklist
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
