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
import { FileEdit, Eye, Info } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function ContratoDetailPage() {
  const params = useParams();
  const [contrato, setContrato] = useState<ContratoConDetalles | null>(null);
  const [loading, setLoading] = useState(true);
  const [firmaLoading, setFirmaLoading] = useState(false);
  const [confirmarFirmaOpen, setConfirmarFirmaOpen] = useState(false);
  const [fechaFirma, setFechaFirma] = useState(new Date().toISOString().split('T')[0]);
  const [notasFirma, setNotasFirma] = useState('');

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
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Contrato enviado para firma');
        fetchContrato();
      } else {
        const errorMsg = data.data?.error || data.error || 'Error enviando contrato para firma';
        toast.error(errorMsg);
      }
    } catch {
      toast.error('Error de conexion al enviar contrato para firma');
    } finally {
      setFirmaLoading(false);
    }
  }

  async function handleConfirmarFirma() {
    setFirmaLoading(true);
    try {
      const res = await fetch(`/api/contratos/${params.id}/firmar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fechaFirma, notas: notasFirma }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Contrato firmado. Email de onboarding enviado.');
        setConfirmarFirmaOpen(false);
        setNotasFirma('');
        fetchContrato();
      } else {
        toast.error(data.error || 'Error confirmando firma');
      }
    } catch {
      toast.error('Error confirmando firma del contrato');
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
            onConfirmarFirma={() => setConfirmarFirmaOpen(true)}
            loading={firmaLoading}
          />
        </div>
      </div>

      <AlertDialog open={confirmarFirmaOpen} onOpenChange={setConfirmarFirmaOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar firma bilateral</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma que ambas partes (empresa y candidato) han firmado el contrato.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="fechaFirma">Fecha de firma</Label>
              <Input
                id="fechaFirma"
                type="date"
                value={fechaFirma}
                onChange={(e) => setFechaFirma(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notasFirma">Notas (opcional)</Label>
              <Textarea
                id="notasFirma"
                placeholder="Agregar notas sobre la firma..."
                value={notasFirma}
                onChange={(e) => setNotasFirma(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Esto disparara automaticamente el email de bienvenida e instrucciones de onboarding para el candidato.
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={firmaLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarFirma}
              disabled={firmaLoading || !fechaFirma}
              className="bg-success hover:bg-success/90 text-white"
            >
              {firmaLoading ? 'Confirmando...' : 'Confirmar firma'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
