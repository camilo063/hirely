'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building, Sliders, Link2, Save, FileCheck, UserCheck, FileSignature } from 'lucide-react';
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
import { toast } from 'sonner';

export default function ConfiguracionPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Cargando configuración...</div>}>
      <ConfiguracionPage />
    </Suspense>
  );
}

function ConfiguracionPage() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'organizacion';

  const [pesoIA, setPesoIA] = useState(40);
  const [pesoHumano, setPesoHumano] = useState(60);
  const [umbral, setUmbral] = useState(60);

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
          <TabsTrigger value="integraciones">
            <Link2 className="h-4 w-4 mr-1" /> Integraciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizacion">
          <Card>
            <CardHeader><CardTitle className="text-base">Datos de la organizacion</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre de la empresa</Label>
                  <Input defaultValue="Hirely Demo" />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input defaultValue="hirely-demo" disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Dias de vencimiento de oferta</Label>
                <Input type="number" defaultValue={30} />
              </div>
              <Button className="bg-teal hover:bg-teal/90 text-white">
                <Save className="h-4 w-4 mr-2" /> Guardar cambios
              </Button>
            </CardContent>
          </Card>
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
          <Card>
            <CardHeader><CardTitle className="text-base">Plantillas de contratos</CardTitle></CardHeader>
            <CardContent>
              <PlantillaContratoEditor />
            </CardContent>
          </Card>
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
      </Tabs>
    </div>
  );
}
