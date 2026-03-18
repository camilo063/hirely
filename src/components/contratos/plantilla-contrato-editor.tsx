'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Save, Trash2, Loader2, FileText, Eye, Code } from 'lucide-react';
import {
  PlantillaContrato, TipoContrato,
  TIPO_CONTRATO_LABELS, VARIABLES_CONTRATO,
} from '@/lib/types/contrato.types';
import { renderPlantillaContrato } from '@/lib/utils/plantillas-contrato-default';

export function PlantillaContratoEditor() {
  const [plantillas, setPlantillas] = useState<PlantillaContrato[]>([]);
  const [selected, setSelected] = useState<PlantillaContrato | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // New plantilla form
  const [showNew, setShowNew] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newTipo, setNewTipo] = useState<TipoContrato>('laboral');
  const [newHtml, setNewHtml] = useState('');

  const fetchPlantillas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/plantillas-contrato');
      if (res.ok) {
        const data = await res.json();
        setPlantillas(data.data || []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlantillas(); }, [fetchPlantillas]);

  const handleCreate = async () => {
    if (!newNombre || !newHtml) {
      toast.error('Nombre y contenido HTML son requeridos');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/plantillas-contrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newNombre,
          tipo: newTipo,
          contenido_html: newHtml,
          variables: VARIABLES_CONTRATO[newTipo]?.map(v => v.key) || [],
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success('Plantilla creada');
      setShowNew(false);
      setNewNombre('');
      setNewHtml('');
      fetchPlantillas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/plantillas-contrato/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: selected.nombre,
          contenido_html: selected.contenido_html,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success('Plantilla actualizada');
      fetchPlantillas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/plantillas-contrato/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success('Plantilla eliminada');
      if (selected?.id === id) setSelected(null);
      fetchPlantillas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const getPreviewHtml = () => {
    const html = selected?.contenido_html || newHtml || '';
    // Generate sample data
    const tipo = (selected?.tipo || newTipo) as TipoContrato;
    const vars = VARIABLES_CONTRATO[tipo] || [];
    const sampleData: Record<string, string> = {};
    for (const v of vars) {
      sampleData[v.key] = v.default_value || `[${v.label}]`;
    }
    sampleData.nombre_completo = 'Juan Pérez García';
    sampleData.cedula = '1.234.567.890';
    sampleData.empresa_nombre = 'Empresa Demo S.A.S.';
    sampleData.cargo = 'Desarrollador Senior';
    return renderPlantillaContrato(html, sampleData);
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando plantillas...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Gestiona las plantillas HTML para cada tipo de contrato. Usa variables con formato <code className="bg-muted px-1 rounded">{`{{variable}}`}</code>.
        </p>
        <Button size="sm" onClick={() => setShowNew(!showNew)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva plantilla
        </Button>
      </div>

      {/* New plantilla form */}
      {showNew && (
        <Card className="border-dashed border-teal">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre</Label>
                <Input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Mi plantilla laboral" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={newTipo} onValueChange={v => setNewTipo(v as TipoContrato)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TIPO_CONTRATO_LABELS) as [TipoContrato, string][]).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                Contenido HTML
                <button type="button" onClick={() => setShowPreview(!showPreview)} className="text-xs text-teal hover:underline">
                  {showPreview ? 'Editor' : 'Vista previa'}
                </button>
              </Label>
              {showPreview ? (
                <div className="border rounded-md p-4 bg-white min-h-[200px] max-h-[400px] overflow-y-auto text-sm"
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
              ) : (
                <Textarea value={newHtml} onChange={e => setNewHtml(e.target.value)} rows={8} className="font-mono text-xs" />
              )}
            </div>

            {/* Variables reference */}
            <div>
              <Label className="text-xs">Variables disponibles para {TIPO_CONTRATO_LABELS[newTipo]}:</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {(VARIABLES_CONTRATO[newTipo] || []).map(v => (
                  <Badge key={v.key} variant="outline" className="text-[10px] cursor-pointer"
                    onClick={() => setNewHtml(prev => prev + `{{${v.key}}}`)}
                  >
                    {`{{${v.key}}}`}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleCreate} disabled={saving} className="bg-teal hover:bg-teal/90 text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Crear plantilla
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing plantillas list */}
      {plantillas.length === 0 && !showNew ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No hay plantillas personalizadas. Se usarán las plantillas por defecto del sistema.
        </p>
      ) : (
        <div className="space-y-2">
          {plantillas.map(p => (
            <Card key={p.id} className={selected?.id === p.id ? 'ring-2 ring-teal' : ''}>
              <CardContent className="py-3">
                {selected?.id === p.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Nombre</Label>
                        <Input value={selected.nombre} onChange={e => setSelected({ ...selected, nombre: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Input value={TIPO_CONTRATO_LABELS[p.tipo as TipoContrato] || p.tipo} disabled />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-2">
                        <Code className="h-3 w-3" /> HTML
                      </Label>
                      <Textarea
                        value={selected.contenido_html}
                        onChange={e => setSelected({ ...selected, contenido_html: e.target.value })}
                        rows={10}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Cancelar</Button>
                      <Button size="sm" onClick={handleUpdate} disabled={saving} className="bg-teal hover:bg-teal/90 text-white">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                        Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-teal" />
                      <div>
                        <p className="text-sm font-medium">{p.nombre}</p>
                        <p className="text-xs text-muted-foreground">{TIPO_CONTRATO_LABELS[p.tipo as TipoContrato] || p.tipo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelected(p)}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
