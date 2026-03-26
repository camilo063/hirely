'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Upload, CheckCircle2, Clock, XCircle, ShieldCheck, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { PortalData, DocumentoConLabel } from '@/lib/types/seleccion.types';

const ESTADO_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pendiente: { icon: <Clock className="h-5 w-5" />, color: 'text-gray-400', label: 'Pendiente' },
  subido: { icon: <CheckCircle2 className="h-5 w-5" />, color: 'text-blue-500', label: 'Subido' },
  verificado: { icon: <ShieldCheck className="h-5 w-5" />, color: 'text-green-600', label: 'Verificado' },
  rechazado: { icon: <XCircle className="h-5 w-5" />, color: 'text-red-500', label: 'Rechazado' },
};

export default function PortalDocumentosPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [uploadingTipo, setUploadingTipo] = useState<string | null>(null);

  useEffect(() => {
    fetchPortalData();
  }, [token]);

  async function fetchPortalData() {
    try {
      const res = await fetch(`/api/portal/documentos/${token}`);
      const json = await res.json();

      if (!res.ok) {
        if (json.expired) {
          setExpired(true);
        } else {
          setError(json.error || 'Link invalido');
        }
        return;
      }

      if (json.success) {
        setData(json.data);
      }
    } catch {
      setError('Error cargando portal');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(doc: DocumentoConLabel, file: File) {
    setUploadingTipo(doc.tipo);
    try {
      // Step 1: Get presigned upload URL from server (small JSON request)
      const presignRes = await fetch(`/api/portal/documentos/${token}/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: doc.tipo,
          documento_id: doc.id,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          fileSize: file.size,
        }),
      });
      const presignData = await presignRes.json();

      if (!presignRes.ok) {
        alert(presignData.error || 'Error preparando subida');
        return;
      }

      // Fallback: S3 not configured, use old FormData upload (local dev)
      if (presignData.useFormData) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('tipo', doc.tipo);
        formData.append('documento_id', doc.id);

        const res = await fetch(`/api/portal/documentos/${token}/upload`, {
          method: 'POST',
          body: formData,
        });
        const json = await res.json();
        if (!res.ok) {
          alert(json.error || 'Error subiendo archivo');
          return;
        }
        await fetchPortalData();
        return;
      }

      // Step 2: Upload file directly to S3 (bypasses Vercel 4.5MB limit)
      const uploadRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      if (!uploadRes.ok) {
        alert('Error subiendo archivo a almacenamiento. Intente de nuevo.');
        return;
      }

      // Step 3: Confirm upload in our server (small JSON request)
      const confirmRes = await fetch(`/api/portal/documentos/${token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: doc.tipo,
          documento_id: doc.id,
          filename: file.name,
          s3Url: presignData.s3Url,
        }),
      });
      const confirmData = await confirmRes.json();

      if (!confirmRes.ok) {
        alert(confirmData.error || 'Error confirmando subida');
        return;
      }

      // Refresh data
      await fetchPortalData();
    } catch {
      alert('Error de conexion. Verifique su internet e intente de nuevo.');
    } finally {
      setUploadingTipo(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal mb-4" />
        <p className="text-muted-foreground">Cargando portal...</p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="h-12 w-12 text-orange mx-auto mb-4" />
        <h1 className="text-xl font-bold text-navy mb-2">Link expirado</h1>
        <p className="text-muted-foreground">
          El link para subir documentos ha expirado. Contacta al equipo de recursos humanos
          para solicitar uno nuevo.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-navy mb-2">Link invalido</h1>
        <p className="text-muted-foreground">{error || 'No se encontro el portal.'}</p>
      </div>
    );
  }

  const progressPercent = data.progreso.total > 0
    ? Math.round(((data.progreso.subidos + data.progreso.verificados) / data.progreso.total) * 100)
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="bg-navy text-white rounded-t-lg px-6 py-5 text-center">
        <h1 className="text-xl font-bold">{data.empresa.nombre}</h1>
      </div>

      <div className="bg-white rounded-b-lg border border-t-0 p-6 mb-6">
        {data.completo ? (
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
            <h2 className="text-xl font-bold text-navy mb-1">Documentos completos</h2>
            <p className="text-muted-foreground">
              Todos los documentos han sido recibidos. El equipo de recursos humanos
              los revisara pronto.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-navy mb-1">
              Hola, {data.candidato.nombre}!
            </h2>
            <p className="text-muted-foreground text-sm mb-1">
              Felicidades por tu seleccion para <strong>{data.vacante.titulo}</strong>.
            </p>
            <p className="text-muted-foreground text-sm">
              Por favor sube los documentos indicados a continuacion.
            </p>
          </>
        )}
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progreso</span>
          <span className="font-medium text-navy">
            {data.progreso.subidos + data.progreso.verificados} de {data.progreso.total} documentos
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        {data.progreso.requeridos_faltantes > 0 && (
          <p className="text-xs text-orange mt-1">
            {data.progreso.requeridos_faltantes} documento(s) obligatorio(s) pendiente(s)
          </p>
        )}
      </div>

      {/* Document list */}
      <div className="space-y-3">
        {data.documentos.map((doc) => (
          <DocumentoItem
            key={doc.id}
            doc={doc}
            uploading={uploadingTipo === doc.tipo}
            onUpload={handleUpload}
          />
        ))}
      </div>
    </div>
  );
}

function DocumentoItem({
  doc,
  uploading,
  onUpload,
}: {
  doc: DocumentoConLabel;
  uploading: boolean;
  onUpload: (doc: DocumentoConLabel, file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const config = ESTADO_CONFIG[doc.estado] || ESTADO_CONFIG.pendiente;
  const canUpload = doc.estado === 'pendiente' || doc.estado === 'rechazado';

  return (
    <Card className={doc.estado === 'rechazado' ? 'border-red-200 bg-red-50/30' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${config.color}`}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-medium text-sm text-navy">{doc.label}</p>
              {doc.requerido && (
                <span className="text-[10px] font-medium text-orange bg-orange/10 px-1.5 py-0.5 rounded">
                  Obligatorio
                </span>
              )}
            </div>
            {doc.descripcion && (
              <p className="text-xs text-muted-foreground">{doc.descripcion}</p>
            )}
            {doc.estado === 'rechazado' && doc.nota_rechazo && (
              <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                {doc.nota_rechazo}
              </p>
            )}
            {(doc.estado === 'subido' || doc.estado === 'verificado') && doc.nombre_archivo && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {doc.nombre_archivo}
              </p>
            )}
          </div>
          <div className="shrink-0">
            {canUpload && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(doc, file);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant={doc.estado === 'rechazado' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-1"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {doc.estado === 'rechazado' ? 'Re-subir' : 'Subir'}
                </Button>
              </>
            )}
            {doc.estado === 'subido' && (
              <span className="text-xs text-blue-500 font-medium">{config.label}</span>
            )}
            {doc.estado === 'verificado' && (
              <span className="text-xs text-green-600 font-medium">{config.label}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
