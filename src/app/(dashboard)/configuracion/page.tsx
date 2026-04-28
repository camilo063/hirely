'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building, Building2, Sliders, Link2, Save, FileCheck, UserCheck, FileSignature, Mail, Info, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { LinkedInConnectButton } from '@/components/linkedin/linkedin-connect-button';
import { ChecklistConfig } from '@/components/configuracion/checklist-config';
import { PlantillaEditor } from '@/components/onboarding/plantilla-editor';
import { DocumentosOnboardingConfig } from '@/components/onboarding/documentos-onboarding-config';
import { PlantillaContratoEditor } from '@/components/contratos/plantilla-contrato-editor';
import { TiposContratoConfig } from '@/components/configuracion/tipos-contrato-config';
import { TipoPlantillaMapeo } from '@/components/configuracion/tipo-plantilla-mapeo';
import { EmailTemplatesConfig } from '@/components/configuracion/email-templates-config';
import { TabNotificaciones } from '@/components/configuracion/TabNotificaciones';
import { toast } from 'sonner';

export default function ConfiguracionPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Cargando configuración...</div>}>
      <ConfiguracionPage />
    </Suspense>
  );
}

function EmpresaConfig() {
  const [nit, setNit] = useState('');
  const [representanteLegal, setRepresentanteLegal] = useState('');
  const [cargoRepresentante, setCargoRepresentante] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [pais, setPais] = useState('Colombia');
  const [telefonoEmpresa, setTelefonoEmpresa] = useState('');
  const [emailContratos, setEmailContratos] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/configuracion/empresa')
      .then(res => res.json())
      .then(data => {
        const cfg = data.data?.config || data.config;
        if (cfg) {
          setNit(cfg.nit || '');
          setRepresentanteLegal(cfg.representante_legal || '');
          setCargoRepresentante(cfg.cargo_representante || '');
          setDireccion(cfg.direccion || '');
          setCiudad(cfg.ciudad || '');
          setDepartamento(cfg.departamento || '');
          setPais(cfg.pais || 'Colombia');
          setTelefonoEmpresa(cfg.telefono_empresa || '');
          setEmailContratos(cfg.email_empresa || '');
        }
      })
      .catch(() => toast.error('Error al cargar datos de empresa'));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/configuracion/empresa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nit,
          representante_legal: representanteLegal,
          cargo_representante: cargoRepresentante,
          direccion,
          ciudad,
          departamento,
          pais,
          telefono_empresa: telefonoEmpresa,
          email_empresa: emailContratos,
        }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      toast.success('Datos de empresa guardados correctamente');
    } catch {
      toast.error('Error al guardar datos de empresa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Datos de la empresa para contratos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>NIT</Label>
            <Input value={nit} onChange={(e) => setNit(e.target.value)} placeholder="900.123.456-7" />
          </div>
          <div className="space-y-2">
            <Label>Representante Legal</Label>
            <Input value={representanteLegal} onChange={(e) => setRepresentanteLegal(e.target.value)} placeholder="Nombre completo" />
          </div>
          <div className="space-y-2">
            <Label>Cargo del Representante</Label>
            <Input value={cargoRepresentante} onChange={(e) => setCargoRepresentante(e.target.value)} placeholder="Gerente General" />
          </div>
          <div className="space-y-2">
            <Label>Direccion</Label>
            <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle 100 #15-20, Oficina 301" />
          </div>
          <div className="space-y-2">
            <Label>Ciudad</Label>
            <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Bogota" />
          </div>
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Input value={departamento} onChange={(e) => setDepartamento(e.target.value)} placeholder="Cundinamarca" />
          </div>
          <div className="space-y-2">
            <Label>Pais</Label>
            <Input value={pais} onChange={(e) => setPais(e.target.value)} placeholder="Colombia" />
          </div>
          <div className="space-y-2">
            <Label>Telefono Empresa</Label>
            <Input value={telefonoEmpresa} onChange={(e) => setTelefonoEmpresa(e.target.value)} placeholder="+57 601 234 5678" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Email Contratos</Label>
            <Input type="email" value={emailContratos} onChange={(e) => setEmailContratos(e.target.value)} placeholder="contratos@empresa.com" />
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800">
            Estos datos apareceran pre-llenados en todos los contratos generados por Hirely.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal/90 text-white">
          <Save className="h-4 w-4 mr-2" /> {saving ? 'Guardando...' : 'Guardar datos de empresa'}
        </Button>
      </CardContent>
    </Card>
  );
}

function ConfiguracionPage() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'organizacion';

  const [pesoIA, setPesoIA] = useState(40);
  const [pesoHumano, setPesoHumano] = useState(60);
  const [umbral, setUmbral] = useState(60);

  // Organizacion tab state
  const [orgNombre, setOrgNombre] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgLogoPreview, setOrgLogoPreview] = useState('');
  const [orgDiasVencimiento, setOrgDiasVencimiento] = useState(30);
  const [orgSaving, setOrgSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    fetch('/api/configuracion/empresa')
      .then(res => res.json())
      .then(data => {
        const d = data.data || data;
        const nombre = d.nombre_empresa || '';
        setOrgNombre(nombre);
        setOrgSlug(nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
        setOrgLogoPreview(d.logo_display_url || d.logo_url || '');
      })
      .catch(() => {});
  }, []);

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen (JPG o PNG)');
      return;
    }
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/configuracion/logo', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Error al subir el logo');
      const data = json.data || json;
      setOrgLogoPreview(data.displayUrl || data.url || '');
      toast.success('Logo actualizado');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al subir el logo';
      toast.error(msg);
    } finally {
      setLogoUploading(false);
    }
  };

  // Handle LinkedIn OAuth callback params
  useEffect(() => {
    const linkedinSuccess = searchParams.get('linkedin_success');
    const linkedinError = searchParams.get('linkedin_error');

    if (linkedinSuccess === 'true') {
      toast.success('LinkedIn conectado exitosamente');
    }
    if (linkedinError) {
      toast.error(`Error de LinkedIn: ${linkedinError}`);
    }
  }, [searchParams]);

  const handleSaveScoring = () => {
    if (pesoIA + pesoHumano !== 100) {
      toast.error('Los pesos deben sumar 100%');
      return;
    }
    toast.success('Configuracion de scoring guardada');
  };

  return (
    <div className="animate-fade-in">
      <Breadcrumbs />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Configuracion</h1>
        <p className="text-muted-foreground">Ajusta la configuracion de tu organizacion</p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="organizacion">
            <Building className="h-4 w-4 mr-1" /> Organizacion
          </TabsTrigger>
          <TabsTrigger value="empresa">
            <Building2 className="h-4 w-4 mr-1" /> Empresa
          </TabsTrigger>
          <TabsTrigger value="scoring">
            <Sliders className="h-4 w-4 mr-1" /> Scoring
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FileCheck className="h-4 w-4 mr-1" /> Documentos
          </TabsTrigger>
          <TabsTrigger value="onboarding">
            <UserCheck className="h-4 w-4 mr-1" /> Onboarding
          </TabsTrigger>
          <TabsTrigger value="contratos">
            <FileSignature className="h-4 w-4 mr-1" /> Contratos
          </TabsTrigger>
          <TabsTrigger value="emails">
            <Mail className="h-4 w-4 mr-1" /> Emails
          </TabsTrigger>
          <TabsTrigger value="integraciones">
            <Link2 className="h-4 w-4 mr-1" /> Integraciones
          </TabsTrigger>
          <TabsTrigger value="notificaciones">
            <Bell className="h-4 w-4 mr-1" /> Notificaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizacion">
          <Card>
            <CardHeader><CardTitle className="text-base">Datos de la organizacion</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre de la empresa</Label>
                  <Input value={orgNombre} onChange={(e) => setOrgNombre(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={orgSlug} disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Logo de la empresa</Label>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {orgLogoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={orgLogoPreview} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                      <Building className="h-8 w-8 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      disabled={logoUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                        e.target.value = '';
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {logoUploading ? 'Subiendo...' : 'JPG o PNG. Maximo 10MB. Se guarda automaticamente al seleccionar.'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dias de vencimiento de oferta</Label>
                <Input type="number" value={orgDiasVencimiento} onChange={(e) => setOrgDiasVencimiento(parseInt(e.target.value) || 30)} />
              </div>
              <Button
                className="bg-teal hover:bg-teal/90 text-white"
                disabled={orgSaving}
                onClick={async () => {
                  setOrgSaving(true);
                  try {
                    const res = await fetch('/api/configuracion/empresa', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ nombre_empresa: orgNombre }),
                    });
                    if (!res.ok) throw new Error();
                    toast.success('Datos de organizacion guardados');
                  } catch {
                    toast.error('Error al guardar');
                  } finally {
                    setOrgSaving(false);
                  }
                }}
              >
                <Save className="h-4 w-4 mr-2" /> {orgSaving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="empresa">
          <EmpresaConfig />
        </TabsContent>

        <TabsContent value="scoring">
          <Card>
            <CardHeader><CardTitle className="text-base">Configuracion de Scoring Dual</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Define los pesos relativos de la entrevista IA vs la evaluacion humana para el calculo del score final.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label>Peso Entrevista IA (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={pesoIA}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setPesoIA(val);
                      setPesoHumano(100 - val);
                    }}
                  />
                  <div className="w-full bg-soft-gray rounded-full h-3">
                    <div className="bg-teal h-3 rounded-full transition-all" style={{ width: `${pesoIA}%` }} />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Peso Evaluacion Humana (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={pesoHumano}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setPesoHumano(val);
                      setPesoIA(100 - val);
                    }}
                  />
                  <div className="w-full bg-soft-gray rounded-full h-3">
                    <div className="bg-orange h-3 rounded-full transition-all" style={{ width: `${pesoHumano}%` }} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Umbral de preseleccion ATS (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={umbral}
                  onChange={(e) => setUmbral(parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Candidatos con score ATS menor a este umbral seran descartados automaticamente.
                </p>
              </div>

              <Button onClick={handleSaveScoring} className="bg-teal hover:bg-teal/90 text-white">
                <Save className="h-4 w-4 mr-2" /> Guardar configuracion
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos">
          <ChecklistConfig />
        </TabsContent>

        <TabsContent value="onboarding">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Plantilla de email de bienvenida</CardTitle></CardHeader>
              <CardContent>
                <PlantillaEditor />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Documentos adjuntos de onboarding</CardTitle></CardHeader>
              <CardContent>
                <DocumentosOnboardingConfig />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contratos">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Tipos de contrato</CardTitle></CardHeader>
              <CardContent>
                <TiposContratoConfig />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Plantillas de contratos</CardTitle></CardHeader>
              <CardContent>
                <PlantillaContratoEditor />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Mapeo tipo → plantilla</CardTitle></CardHeader>
              <CardContent>
                <TipoPlantillaMapeo />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="emails">
          <EmailTemplatesConfig />
        </TabsContent>

        <TabsContent value="integraciones">
          <div className="space-y-4">
            {/* LinkedIn — real OAuth integration */}
            <LinkedInConnectButton />

            {/* Other integrations — placeholder cards */}
            {[
              { name: 'Dapta (IA)', desc: 'Entrevistas automatizadas con IA', connected: false },
              { name: 'DocuSign', desc: 'Firma electronica de contratos', connected: false },
              { name: 'Google Calendar', desc: 'Agendamiento de entrevistas', connected: false },
              { name: 'SendGrid', desc: 'Envio de emails transaccionales', connected: false },
              { name: 'OpenAI', desc: 'Parsing de CVs y analisis de texto', connected: false },
            ].map((integration) => (
              <Card key={integration.name}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">{integration.desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium ${integration.connected ? 'text-success' : 'text-muted-foreground'}`}>
                      {integration.connected ? 'Conectado' : 'No configurado'}
                    </span>
                    <Button variant="outline" size="sm">
                      {integration.connected ? 'Desconectar' : 'Configurar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notificaciones">
          <TabNotificaciones />
        </TabsContent>
      </Tabs>
    </div>
  );
}
