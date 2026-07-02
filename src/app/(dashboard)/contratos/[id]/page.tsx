'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Button } from '@/components/ui/button';
import { ContratoEditor } from '@/components/contratos/contrato-editor';
import { ContratoPreview } from '@/components/contratos/contrato-preview';
import { FirmaStatus } from '@/components/contratos/firma-status';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { ContratoConDetalles } from '@/lib/types/contrato.types';
import {
  mapEmpresaConfigToDatos, getStaleEmpresaFields, EMPRESA_FIELD_LABELS,
} from '@/lib/utils/empresa-contrato';
import { toast } from 'sonner';
import { FileEdit, Eye, Info, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
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
  const [empresaDatos, setEmpresaDatos] = useState<Record<string, string>>({});
  const [regenerating, setRegenerating] = useState(false);
  const autoRegenDone = useRef(false);

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

  const fetchEmpresa = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracion/empresa');
      if (!res.ok) return;
      const json = await res.json();
      setEmpresaDatos(mapEmpresaConfigToDatos(json.data || {}));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchContrato();
    fetchEmpresa();
  }, [fetchContrato, fetchEmpresa]);

  const handleRegenerar = useCallback(async (silent = false) => {
    if (!params.id) return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/contratos/${params.id}/regenerar`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setContrato(data.data);
      if (!silent) toast.success('Contrato regenerado con los datos actuales de la empresa');
      else toast.info('Datos de empresa actualizados automáticamente en el contrato');
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : 'Error al regenerar');
    } finally {
      setRegenerating(false);
    }
  }, [params.id]);

  // Auto-regenerar SOLO borradores sin editar (version 1) cuyos datos de empresa
  // difieren de la config actual. Así el borrador recién creado se sincroniza sin
  // pisar ediciones manuales (que ya habrían subido la versión).
  useEffect(() => {
    if (autoRegenDone.current || regenerating) return;
    if (!contrato || Object.keys(empresaDatos).length === 0) return;
    const editable = contrato.estado === 'borrador' || contrato.estado === 'generado';
    const stale = getStaleEmpresaFields(contrato.datos_contrato, empresaDatos);
    if (editable && (contrato.version || 1) === 1 && stale.length > 0) {
      autoRegenDone.current = true;
      handleRegenerar(true);
    }
  }, [contrato, empresaDatos, regenerating, handleRegenerar]);

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
  const staleFields = isEditable ? getStaleEmpresaFields(contrato.datos_contrato, empresaDatos) : [];

  return (
    <div>
      <Breadcrumbs />

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">
            Contrato — {contrato.candidato_nombre} {contrato.candidato_apellido}
          </h1>
          <p className="text-muted-foreground">{contrato.vacante_titulo}</p>
        </div>
        {isEditable && (
          <Button
            variant="outline"
            onClick={() => handleRegenerar(false)}
            disabled={regenerating}
          >
            {regenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
            Regenerar con datos actuales
          </Button>
        )}
      </div>

      {isEditable && staleFields.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Los datos de la empresa cambiaron desde que se generó este contrato
              </p>
              <p className="text-xs text-amber-800 mt-1">
                Desactualizados: {staleFields.map(f => EMPRESA_FIELD_LABELS[f] || f).join(', ')}.
                Regenera el contrato para aplicar la información actual de Configuración › Empresa.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => handleRegenerar(false)}
              disabled={regenerating}
              className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
            >
              {regenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
              Regenerar ahora
            </Button>
          </div>
        </div>
      )}

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
                key={contrato.version}
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
