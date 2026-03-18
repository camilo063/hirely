'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Eye, RotateCcw, Save, Copy, Loader2 } from 'lucide-react';
import type { OnboardingConfig } from '@/lib/types/onboarding.types';
import {
  VARIABLES_DISPONIBLES,
  PLANTILLA_BIENVENIDA_DEFAULT,
  ASUNTO_BIENVENIDA_DEFAULT,
} from '@/lib/types/onboarding.types';

export function PlantillaEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plantilla, setPlantilla] = useState('');
  const [asunto, setAsunto] = useState('');
  const [emailRemitente, setEmailRemitente] = useState('');
  const [nombreRemitente, setNombreRemitente] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracion/onboarding');
      if (res.ok) {
        const { data } = await res.json();
        setPlantilla(data.plantilla_bienvenida || PLANTILLA_BIENVENIDA_DEFAULT);
        setAsunto(data.asunto_bienvenida || ASUNTO_BIENVENIDA_DEFAULT);
        setEmailRemitente(data.email_remitente || '');
        setNombreRemitente(data.nombre_remitente || '');
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/configuracion/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantilla_bienvenida: plantilla,
          asunto_bienvenida: asunto,
          email_remitente: emailRemitente,
          nombre_remitente: nombreRemitente,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Configuración de onboarding guardada');
    } catch {
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPlantilla(PLANTILLA_BIENVENIDA_DEFAULT);
    setAsunto(ASUNTO_BIENVENIDA_DEFAULT);
    toast.info('Plantilla restaurada a la versión por defecto');
  };

  const insertVariable = (key: string) => {
    const tag = `{{${key}}}`;
    setPlantilla(prev => prev + tag);
    toast.info(`Variable ${tag} insertada`);
  };

  const renderPreview = () => {
    let html = plantilla;
    for (const v of VARIABLES_DISPONIBLES) {
      const regex = new RegExp(`\\{\\{${v.key}\\}\\}`, 'g');
      html = html.replace(regex, v.ejemplo);
    }
    return html;
  };

  if (loading) {
    return <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Remitente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email_rem">Email remitente</Label>
          <Input
            id="email_rem"
            type="email"
            value={emailRemitente}
            onChange={e => setEmailRemitente(e.target.value)}
            placeholder="rrhh@empresa.com"
          />
        </div>
        <div>
          <Label htmlFor="nombre_rem">Nombre remitente</Label>
          <Input
            id="nombre_rem"
            value={nombreRemitente}
            onChange={e => setNombreRemitente(e.target.value)}
            placeholder="Recursos Humanos"
          />
        </div>
      </div>

      {/* Asunto */}
      <div>
        <Label htmlFor="asunto">Asunto del email</Label>
        <Input
          id="asunto"
          value={asunto}
          onChange={e => setAsunto(e.target.value)}
          placeholder={ASUNTO_BIENVENIDA_DEFAULT}
        />
        <p className="text-xs text-muted-foreground mt-1">Puedes usar variables como {'{{nombre_empleado}}'} en el asunto.</p>
      </div>

      {/* Editor + Variables side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Template editor */}
        <div className="lg:col-span-2">
          <Label htmlFor="plantilla">Plantilla HTML del email</Label>
          <Textarea
            id="plantilla"
            value={plantilla}
            onChange={e => setPlantilla(e.target.value)}
            rows={20}
            className="font-mono text-xs"
          />
        </div>

        {/* Variables panel */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Variables disponibles</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5">
            {VARIABLES_DISPONIBLES.map(v => (
              <div key={v.key} className="flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{v.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{v.ejemplo}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 shrink-0"
                  onClick={() => insertVariable(v.key)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </Button>
        <Button variant="outline" onClick={() => setShowPreview(!showPreview)} className="gap-1.5">
          <Eye className="h-4 w-4" />
          {showPreview ? 'Ocultar' : 'Vista'} previa
        </Button>
        <Button variant="ghost" onClick={handleReset} className="gap-1.5 text-muted-foreground">
          <RotateCcw className="h-4 w-4" />
          Restaurar default
        </Button>
      </div>

      {/* Preview */}
      {showPreview && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Vista previa</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div
              className="p-4 bg-white"
              dangerouslySetInnerHTML={{ __html: renderPreview() }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
