'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, FileText, Eye, Wand2 } from 'lucide-react';
import {
  TipoContrato, DatosContrato, PlantillaContrato,
  VARIABLES_CONTRATO, TIPO_CONTRATO_LABELS, VariableContrato,
} from '@/lib/types/contrato.types';
import { renderPlantillaContrato, PLANTILLAS_CONTRATO_DEFAULT } from '@/lib/utils/plantillas-contrato-default';

interface Props {
  aplicacionId: string;
  candidatoId?: string;
  vacanteId?: string;
  candidatoNombre?: string;
  vacanteTitulo?: string;
  onSuccess?: (contratoId: string) => void;
  onCancel?: () => void;
}

export function GenerarContratoForm({
  aplicacionId, candidatoId, vacanteId,
  candidatoNombre, vacanteTitulo, onSuccess, onCancel,
}: Props) {
  const [tipo, setTipo] = useState<TipoContrato>('laboral');
  const [datos, setDatos] = useState<Partial<DatosContrato>>({});
  const [plantillaId, setPlantillaId] = useState<string | null>(null);
  const [plantillas, setPlantillas] = useState<PlantillaContrato[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('datos');

  const variables = VARIABLES_CONTRATO[tipo] || [];

  const fetchPlantillas = useCallback(async () => {
    try {
      const res = await fetch('/api/plantillas-contrato');
      if (res.ok) {
        const data = await res.json();
        setPlantillas(data.data || []);
      }
    } catch { /* ignore */ }
  }, []);

  const autoPoblar = useCallback(async () => {
    setAutoLoading(true);
    try {
      const res = await fetch(`/api/contratos/auto-poblar?aplicacion_id=${aplicacionId}&tipo=${tipo}`);
      if (res.ok) {
        const data = await res.json();
        setDatos(prev => ({ ...prev, ...data.data }));
        toast.success('Datos auto-poblados');
      }
    } catch {
      toast.error('Error al auto-poblar datos');
    } finally {
      setAutoLoading(false);
    }
  }, [aplicacionId, tipo]);

  useEffect(() => {
    fetchPlantillas();
    autoPoblar();
  }, [fetchPlantillas, autoPoblar]);

  const updateDato = (key: string, value: string | number) => {
    setDatos(prev => ({ ...prev, [key]: value }));
  };

  const getPreviewHtml = () => {
    const tpl = plantillas.find(p => p.id === plantillaId);
    const template = tpl?.contenido_html || PLANTILLAS_CONTRATO_DEFAULT[tipo]?.contenido_html || '';
    return renderPlantillaContrato(template, datos as Record<string, unknown>);
  };

  const handleSubmit = async () => {
    // Validate required fields
    const missingRequired = variables
      .filter(v => v.required && !datos[v.key as keyof DatosContrato])
      .map(v => v.label);

    if (missingRequired.length > 0) {
      toast.error(`Campos requeridos: ${missingRequired.slice(0, 3).join(', ')}${missingRequired.length > 3 ? '...' : ''}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aplicacion_id: aplicacionId,
          candidato_id: candidatoId,
          vacante_id: vacanteId,
          plantilla_id: plantillaId,
          tipo,
          datos,
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

  const renderField = (v: VariableContrato) => {
    const value = (datos[v.key as keyof DatosContrato] as string) || '';

    if (v.key === 'obligaciones' || v.key === 'objeto_contrato' || v.key === 'clausulas_adicionales') {
      return (
        <div key={v.key} className="col-span-2">
          <Label className="flex items-center gap-1.5">
            {v.label}
            {v.required && <span className="text-red-500">*</span>}
            {v.tipo === 'auto' && <Badge variant="secondary" className="text-[10px] px-1 py-0">Auto</Badge>}
          </Label>
          <Textarea
            value={value}
            onChange={e => updateDato(v.key, e.target.value)}
            placeholder={v.default_value || v.label}
            rows={3}
          />
        </div>
      );
    }

    return (
      <div key={v.key}>
        <Label className="flex items-center gap-1.5">
          {v.label}
          {v.required && <span className="text-red-500">*</span>}
          {v.tipo === 'auto' && <Badge variant="secondary" className="text-[10px] px-1 py-0">Auto</Badge>}
        </Label>
        <Input
          type={v.key === 'fecha_inicio' || v.key === 'fecha_fin' || v.key === 'fecha_contrato' ? 'date' : v.key === 'salario' ? 'number' : 'text'}
          value={v.key === 'fecha_contrato' ? '' : value}
          onChange={e => updateDato(v.key, v.key === 'salario' ? Number(e.target.value) || 0 : e.target.value)}
          placeholder={v.default_value || v.label}
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Generar contrato</h3>
          {candidatoNombre && (
            <p className="text-sm text-muted-foreground">
              {candidatoNombre} — {vacanteTitulo}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={autoPoblar} disabled={autoLoading}>
          {autoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wand2 className="h-4 w-4 mr-1" />}
          Auto-poblar
        </Button>
      </div>

      {/* Type + Template selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Tipo de contrato</Label>
          <Select value={tipo} onValueChange={(v) => { setTipo(v as TipoContrato); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(TIPO_CONTRATO_LABELS) as [TipoContrato, string][]).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Plantilla</Label>
          <Select value={plantillaId || 'default'} onValueChange={(v) => setPlantillaId(v === 'default' ? null : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Plantilla por defecto</SelectItem>
              {plantillas.filter(p => p.tipo === tipo).map(p => (
                <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs: Data / Preview */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="datos">
            <FileText className="h-4 w-4 mr-1" /> Datos del contrato
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4 mr-1" /> Vista previa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datos">
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {variables.map(renderField)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardContent className="pt-4">
              <div
                className="border rounded-lg p-6 bg-white min-h-[400px] text-sm"
                dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-teal hover:bg-teal/90 text-white"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
          Generar contrato
        </Button>
      </div>
    </div>
  );
}
