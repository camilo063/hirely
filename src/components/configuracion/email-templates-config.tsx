'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Mail, ChevronDown, Eye, EyeOff, RotateCcw, Copy, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  DEFAULT_TEMPLATE_SELECCION,
  DEFAULT_TEMPLATE_RECHAZO,
  VARIABLES_SELECCION,
  VARIABLES_RECHAZO,
  sustituirVariables,
} from '@/lib/utils/email-templates';

interface EmailConfig {
  email_seleccion_body: string;
  email_rechazo_body: string;
  email_firma_admin: string;
}

interface VariableInfo {
  key: string;
  label: string;
  ejemplo: string;
}

const EMAIL_SECTIONS = [
  {
    key: 'email_seleccion_body' as const,
    title: 'Email de Seleccion',
    description:
      'Se envia al candidato cuando es seleccionado para una vacante. Incluye los documentos requeridos y el enlace al portal.',
    variables: VARIABLES_SELECCION,
    defaultTemplate: DEFAULT_TEMPLATE_SELECCION,
  },
  {
    key: 'email_rechazo_body' as const,
    title: 'Email de Rechazo',
    description:
      'Se envia al candidato cuando no es seleccionado. El mensaje debe ser profesional y respetuoso.',
    variables: VARIABLES_RECHAZO,
    defaultTemplate: DEFAULT_TEMPLATE_RECHAZO,
  },
];

export function EmailTemplatesConfig() {
  const [config, setConfig] = useState<EmailConfig>({
    email_seleccion_body: '',
    email_rechazo_body: '',
    email_firma_admin: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [previewSection, setPreviewSection] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const res = await fetch('/api/configuracion/emails');
      const json = await res.json();
      if (json.success) {
        setConfig({
          email_seleccion_body: json.data.email_seleccion_body || '',
          email_rechazo_body: json.data.email_rechazo_body || '',
          email_firma_admin: json.data.email_firma_admin || '',
        });
      }
    } catch (error) {
      console.error('Error fetching email config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(field: keyof EmailConfig) {
    setSaving(field);
    try {
      const res = await fetch('/api/configuracion/emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: config[field] }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Configuracion guardada');
      } else {
        toast.error(json.error || 'Error al guardar');
      }
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(null);
    }
  }

  function handleRestore(sectionKey: 'email_seleccion_body' | 'email_rechazo_body', defaultTemplate: string) {
    setConfig((prev) => ({ ...prev, [sectionKey]: defaultTemplate }));
    toast.info('Plantilla restaurada al valor por defecto. Recuerda guardar los cambios.');
  }

  function renderPreview(sectionKey: string, variables: VariableInfo[], defaultTemplate: string): string {
    const template = config[sectionKey as keyof EmailConfig] || defaultTemplate;
    const exampleValues: Record<string, string> = {};
    for (const v of variables) {
      exampleValues[v.key] = v.ejemplo;
    }
    return sustituirVariables(template, exampleValues);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Email firma admin */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email para contratos firmados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Email del responsable que firma contratos en nombre de la empresa.
            Si no se configura, se usara el email del primer administrador.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label>Email de firma</Label>
              <Input
                type="email"
                placeholder="firma@empresa.com"
                value={config.email_firma_admin}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    email_firma_admin: e.target.value,
                  }))
                }
              />
            </div>
            <Button
              onClick={() => handleSave('email_firma_admin')}
              disabled={saving === 'email_firma_admin'}
              className="bg-teal hover:bg-teal/90 text-white"
            >
              {saving === 'email_firma_admin' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="ml-2">Guardar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email templates accordion */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Plantillas de email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground mb-4">
            Personaliza el contenido HTML de los emails que se envian a los candidatos.
            Si dejas un campo vacio, se usara la plantilla por defecto del sistema.
          </p>

          {EMAIL_SECTIONS.map((section) => {
            const isOpen = openSection === section.key;
            const isPreview = previewSection === section.key;
            return (
              <div
                key={section.key}
                className="border rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                  onClick={() =>
                    setOpenSection(isOpen ? null : section.key)
                  }
                >
                  <span className="font-medium text-sm">
                    {section.title}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-4 border-t">
                    <p className="text-sm text-muted-foreground pt-3">
                      {section.description}
                    </p>

                    {/* Variables panel with copy-on-click */}
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Variables disponibles (click para copiar)
                      </Label>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {section.variables.map((v) => (
                          <button
                            key={v.key}
                            type="button"
                            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-md font-mono cursor-pointer hover:bg-blue-100 transition-colors border border-blue-200"
                            title={`${v.label} — Ej: ${v.ejemplo}`}
                            onClick={() => {
                              navigator.clipboard.writeText(`{{${v.key}}}`);
                              toast.success(`Copiado: {{${v.key}}}`);
                            }}
                          >
                            <Copy className="h-3 w-3" />
                            {`{{${v.key}}}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* HTML content editor */}
                    <div className="space-y-2">
                      <Label>Contenido HTML del email</Label>
                      <Textarea
                        rows={12}
                        className="font-mono text-xs"
                        placeholder={`Escribe tu plantilla HTML aqui o usa la plantilla por defecto...`}
                        value={config[section.key]}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            [section.key]: e.target.value,
                          }))
                        }
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        onClick={() => handleSave(section.key)}
                        disabled={saving === section.key}
                        size="sm"
                        className="bg-teal hover:bg-teal/90 text-white"
                      >
                        {saving === section.key ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Guardar plantilla
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPreviewSection(isPreview ? null : section.key)
                        }
                      >
                        {isPreview ? (
                          <EyeOff className="h-4 w-4 mr-2" />
                        ) : (
                          <Eye className="h-4 w-4 mr-2" />
                        )}
                        {isPreview ? 'Ocultar previa' : 'Ver previa'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() =>
                          handleRestore(section.key, section.defaultTemplate)
                        }
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restaurar default
                      </Button>
                    </div>

                    {/* Preview */}
                    {isPreview && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-3 py-2 border-b">
                          <p className="text-xs text-muted-foreground font-medium">
                            Vista previa (con valores de ejemplo)
                          </p>
                        </div>
                        <div
                          className="p-4 bg-white"
                          dangerouslySetInnerHTML={{
                            __html: renderPreview(
                              section.key,
                              section.variables,
                              section.defaultTemplate
                            ),
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Onboarding note */}
          <div className="border rounded-lg p-4 bg-blue-50/50 border-blue-200">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Email de Onboarding
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  La plantilla de onboarding se configura en{' '}
                  <Link
                    href="/configuracion?tab=onboarding"
                    className="underline font-medium hover:text-blue-900"
                  >
                    Configuracion de Onboarding
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
