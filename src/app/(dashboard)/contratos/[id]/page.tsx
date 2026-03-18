'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ContratoEditor } from '@/components/contratos/contrato-editor';
import { ContratoPreview } from '@/components/contratos/contrato-preview';
import { FirmaStatus } from '@/components/contratos/firma-status';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { ContratoConDetalles } from '@/lib/types/contrato.types';
import { toast } from 'sonner';
import { FileEdit, Eye } from 'lucide-react';

export default function ContratoDetailPage() {
  const params = useParams();
  const [contrato, setContrato] = useState<ContratoConDetalles | null>(null);
  const [loading, setLoading] = useState(true);
  const [firmaLoading, setFirmaLoading] = useState(false);

  const fetchContrato = useCallback(async () => {
    try {
      const res = await fetch(`/api/contratos/${params.id}`);
      const data = await res.json();
      if (data.success) setContrato(data.data);
    } catch {
      toast.error('Error cargando contrato');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchContrato();
  }, [fetchContrato]);

  async function handleEnviarFirma() {
    setFirmaLoading(true);
    try {
      const res = await fetch(`/api/contratos/${params.id}/firmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'docusign' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Contrato enviado para firma');
        fetchContrato();
      }
    } catch {
      toast.error('Error enviando contrato para firma');
    } finally {
      setFirmaLoading(false);
    }
  }

  if (loading) return <TableSkeleton />;
  if (!contrato) return <p className="text-muted-foreground p-8">Contrato no encontrado</p>;

  const isEditable = contrato.estado === 'borrador' || contrato.estado === 'generado';

  return (
    <div>
      <Breadcrumbs />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">
          Contrato — {contrato.candidato_nombre} {contrato.candidato_apellido}
        </h1>
        <p className="text-muted-foreground">{contrato.vacante_titulo}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue={isEditable ? 'editor' : 'preview'}>
            <TabsList>
              <TabsTrigger value="editor">
                <FileEdit className="h-4 w-4 mr-1" /> Editor
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Eye className="h-4 w-4 mr-1" /> Vista previa
              </TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="mt-4">
              <ContratoEditor
                contrato={contrato}
                onSaved={(updated) => setContrato(updated)}
              />
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <ContratoPreview
                contrato={contrato}
                onEstadoChange={(updated) => setContrato(updated)}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <FirmaStatus
            estado={contrato.estado}
            firmaUrl={null}
            firmadoAt={contrato.firmado_at ? String(contrato.firmado_at) : null}
            onEnviarFirma={handleEnviarFirma}
            loading={firmaLoading}
          />
        </div>
      </div>
    </div>
  );
}
