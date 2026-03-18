'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, RotateCcw, History, Loader2, Code, FileText } from 'lucide-react';
import {
  ContratoConDetalles, ContratoVersion, DatosContrato,
  TipoContrato, VARIABLES_CONTRATO,
} from '@/lib/types/contrato.types';
import { useTiposContrato } from '@/hooks/useTiposContrato';

interface Props {
  contrato: ContratoConDetalles;
  onSaved?: (contrato: ContratoConDetalles) => void;
}

export function ContratoEditor({ contrato, onSaved }: Props) {
  const [datos, setDatos] = useState<DatosContrato>(contrato.datos_contrato || {} as DatosContrato);
  const [htmlContent, setHtmlContent] = useState(contrato.contenido_html || '');
  const [notaCambio, setNotaCambio] = useState('');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [versiones, setVersiones] = useState<ContratoVersion[]>([]);
  const [showVersiones, setShowVersiones] = useState(false);

  const { getTipoLabel } = useTiposContrato();
  const tipo = contrato.tipo || 'laboral';
  const variables = VARIABLES_CONTRATO[tipo as TipoContrato] || VARIABLES_CONTRATO['laboral'] || [];
  const isEditable = contrato.estado === 'borrador' || contrato.estado === 'generado';

  const fetchVersiones = useCallback(async () => {
    try {
      const res = await fetch(`/api/contratos/${contrato.id}/versiones`);
      if (res.ok) {
        const data = await res.json();
        setVersiones(data.data || []);
      }
    } catch { /* ignore */ }
  }, [contrato.id]);

  useEffect(() => {
    if (showVersiones) fetchVersiones();
  }, [showVersiones, fetchVersiones]);

  const updateDato = (key: string, value: string | number) => {
    setDatos(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/contratos/${contrato.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datos,
          contenido_html: htmlContent,
          nota_cambio: notaCambio || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success('Contrato guardado');
      setNotaCambio('');
      onSaved?.(data.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerar = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/contratos/${contrato.id}/regenerar`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setHtmlContent(data.data.contenido_html || '');
      toast.success('HTML regenerado desde plantilla');
      onSaved?.(data.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al regenerar');
    } finally {
      setRegenerating(false);
    }
  };

  const restaurarVersion = (version: ContratoVersion) => {
    if (version.datos_contrato) setDatos(version.datos_contrato);
    if (version.contenido_html) setHtmlContent(version.contenido_html);
    setNotaCambio(`Restaurado desde versión ${version.version}`);
    setShowVersiones(false);
    toast.info(`Versión ${version.version} cargada. Guarda para confirmar.`);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="datos">
        <div className="flex items-center justify-between mb-2">
          <TabsList>
            <TabsTrigger value="datos">
              <FileText className="h-4 w-4 mr-1" /> Datos
            </TabsTrigger>
            <TabsTrigger value="html">
              <Code className="h-4 w-4 mr-1" /> HTML
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setShowVersiones(!showVersiones)}
            >
              <History className="h-4 w-4 mr-1" />
              Versiones ({contrato.version || 1})
            </Button>
            {isEditable && (
              <>
                <Button
                  variant="outline" size="sm"
                  onClick={handleRegenerar}
                  disabled={regenerating}
                >
                  {regenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                  Regenerar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-teal hover:bg-teal/90 text-white"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Guardar
                </Button>
              </>
            )}
          </div>
        </div>

        <TabsContent value="datos">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                {getTipoLabel(tipo)}
                <Badge variant="secondary" className="text-xs">v{contrato.version || 1}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {variables.map(v => {
                  const value = (datos[v.key as keyof DatosContrato] as string) || '';
                  const isTextarea = ['obligaciones', 'objeto_contrato', 'clausulas_adicionales'].includes(v.key);

                  if (isTextarea) {
                    return (
                      <div key={v.key} className="col-span-2">
                        <Label className="flex items-center gap-1.5 text-xs">
                          {v.label}
                          {v.required && <span className="text-red-500">*</span>}
                        </Label>
                        <Textarea
                          value={value}
                          onChange={e => updateDato(v.key, e.target.value)}
                          disabled={!isEditable}
                          rows={2}
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={v.key}>
                      <Label className="flex items-center gap-1.5 text-xs">
                        {v.label}
                        {v.required && <span className="text-red-500">*</span>}
                      </Label>
                      <Input
                        type={v.key === 'salario' ? 'number' : v.key.startsWith('fecha') ? 'date' : 'text'}
                        value={v.key.startsWith('fecha') && !value.includes('-') ? '' : value}
                        onChange={e => updateDato(v.key, v.key === 'salario' ? Number(e.target.value) || 0 : e.target.value)}
                        disabled={!isEditable}
                      />
                    </div>
                  );
                })}
              </div>

              {isEditable && (
                <div className="mt-4">
                  <Label className="text-xs">Nota de cambio (opcional)</Label>
                  <Input
                    value={notaCambio}
                    onChange={e => setNotaCambio(e.target.value)}
                    placeholder="Describe los cambios realizados..."
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="html">
          <Card>
            <CardContent className="pt-4">
              <Textarea
                value={htmlContent}
                onChange={e => setHtmlContent(e.target.value)}
                disabled={!isEditable}
                rows={20}
                className="font-mono text-xs"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Version History Panel */}
      {showVersiones && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Historial de versiones</CardTitle>
          </CardHeader>
          <CardContent>
            {versiones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay versiones registradas</p>
            ) : (
              <div className="space-y-2">
                {versiones.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">
                        Versión {v.version}
                        {v.version === contrato.version && (
                          <Badge className="ml-2 text-[10px]" variant="secondary">Actual</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {v.editado_por_nombre || 'Sistema'} — {new Date(v.created_at).toLocaleString('es-CO')}
                        {v.nota_cambio && ` — ${v.nota_cambio}`}
                      </p>
                    </div>
                    {v.version !== contrato.version && isEditable && (
                      <Button variant="ghost" size="sm" onClick={() => restaurarVersion(v)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Restaurar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
