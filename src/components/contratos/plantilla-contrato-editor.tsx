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
import { useTiposContrato } from '@/hooks/useTiposContrato';

export function PlantillaContratoEditor() {
  const [plantillas, setPlantillas] = useState<PlantillaContrato[]>([]);
  const [selected, setSelected] = useState<PlantillaContrato | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editShowPreview, setEditShowPreview] = useState(false);

  // New plantilla form
  const [showNew, setShowNew] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newTipo, setNewTipo] = useState('laboral');
  const [newHtml, setNewHtml] = useState('');
  const { tipos: tiposContrato, getTipoLabel } = useTiposContrato();

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
          variables: VARIABLES_CONTRATO[newTipo as TipoContrato]?.map(v => v.key) || [],
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

  const getPreviewHtmlFor = (html: string, tipo: string) => {
    const vars = VARIABLES_CONTRATO[tipo as TipoContrato] || VARIABLES_CONTRATO['laboral'] || [];
    const sampleData: Record<string, string> = {};
    for (const v of vars) {
      sampleData[v.key] = v.default_value || `[${v.label}]`;
    }
    sampleData.nombre_completo = 'Juan Pérez García';
    sampleData.cedula = '1.234.567.890';
    sampleData.empresa_nombre = 'Empresa Demo S.A.S.';
    sampleData.cargo = 'Desarrollador Senior';
    sampleData.correo = 'juan.perez@email.com';
    sampleData.telefono = '+57 300 123 4567';
    sampleData.fecha_inicio = new Date().toLocaleDateString('es-CO');
    sampleData.fecha_contrato = new Date().toLocaleDateString('es-CO');
    sampleData.salario = '5.000.000';
    return renderPlantillaContrato(html, sampleData);
  };

  const getPreviewHtml = () => {
    const html = selected?.contenido_html || newHtml || '';
    const tipo = selected?.tipo || newTipo;
    return getPreviewHtmlFor(html, tipo);
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
                <Select value={newTipo} onValueChange={v => setNewTipo(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tiposContrato.map(t => (
                      <SelectItem key={t.slug} value={t.slug}>{t.nombre}</SelectItem>
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
              <Label className="text-xs">Variables disponibles para {getTipoLabel(newTipo)}:</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {(VARIABLES_CONTRATO[newTipo as TipoContrato] || VARIABLES_CONTRATO['laboral'] || []).map(v => (
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
                        <Input value={getTipoLabel(p.tipo)} disabled />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs flex items-center gap-2">
                          {editShowPreview ? <Eye className="h-3 w-3" /> : <Code className="h-3 w-3" />}
                          {editShowPreview ? 'Vista previa' : 'HTML'}
                        </Label>
                        <button
                          type="button"
                          onClick={() => setEditShowPreview(!editShowPreview)}
                          className="text-xs text-teal hover:underline"
                        >
                          {editShowPreview ? 'Editar HTML' : 'Vista previa'}
                        </button>
                      </div>
                      {editShowPreview ? (
                        <div
                          className="border rounded-md p-4 bg-white min-h-[300px] max-h-[500px] overflow-y-auto text-sm"
                          dangerouslySetInnerHTML={{ __html: getPreviewHtmlFor(selected.contenido_html, p.tipo) }}
                        />
                      ) : (
                        <Textarea
                          value={selected.contenido_html}
                          onChange={e => setSelected({ ...selected, contenido_html: e.target.value })}
                          rows={10}
                          className="font-mono text-xs"
                        />
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setSelected(null); setEditShowPreview(false); }}>Cancelar</Button>
                      <Button size="sm" onClick={handleUpdate} disabled={saving} className="bg-teal hover:bg-teal/90 text-white">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                        Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-teal" />
                        <div>
                          <p className="text-sm font-medium">{p.nombre}</p>
                          <p className="text-xs text-muted-foreground">{getTipoLabel(p.tipo)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewId(previewId === p.id ? null : p.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" /> Vista previa
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setSelected(p)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {previewId === p.id && (
                      <div
                        className="mt-3 border rounded-md p-4 bg-white max-h-[500px] overflow-y-auto text-sm"
                        dangerouslySetInnerHTML={{ __html: getPreviewHtmlFor(p.contenido_html, p.tipo) }}
                      />
                    )}
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
