'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  FileText,
  AlertCircle,
  RefreshCw,
  MailCheck,
  PartyPopper,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { PortalData, DocumentoConLabel } from '@/lib/types/seleccion.types';

const ESTADO_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  pendiente: { icon: <Clock className="h-5 w-5" />, color: 'text-gray-400', label: 'Pendiente' },
  subido: { icon: <CheckCircle2 className="h-5 w-5" />, color: 'text-blue-500', label: 'Recibido' },
  verificado: { icon: <ShieldCheck className="h-5 w-5" />, color: 'text-green-600', label: 'Aprobado' },
  rechazado: { icon: <XCircle className="h-5 w-5" />, color: 'text-red-500', label: 'Debes reemplazarlo' },
};

// Debe coincidir con la validacion del servidor (file-storage.ts y presign).
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const EXTENSIONES_VALIDAS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
const ACCEPT_ATTR = EXTENSIONES_VALIDAS.join(',');

/**
 * MIME por extension.
 *
 * El navegador no siempre resuelve `file.type` (pasa con .doc/.docx segun el
 * sistema). Cuando venia vacio se enviaba `application/octet-stream`, que el
 * servidor rechaza, y el candidato recibia un "tipo no permitido" sobre un
 * archivo perfectamente valido. Deducirlo de la extension — que ya validamos —
 * deja cliente y servidor de acuerdo.
 */
const MIME_POR_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function tipoMime(file: File): string {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  const porExtension = MIME_POR_EXTENSION[ext];
  // La extension manda: es lo que el servidor valida y lo que define la key.
  return porExtension || file.type || 'application/octet-stream';
}

/**
 * Valida en el navegador antes de gastar una subida.
 *
 * Antes el archivo viajaba entero al servidor para que este lo rechazara: en
 * movil eso son megas y segundos desperdiciados, y el error llegaba como un
 * `alert()` sin contexto. Ahora el candidato se entera al instante y con un
 * mensaje que dice que hacer.
 */
function validarArchivo(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!EXTENSIONES_VALIDAS.includes(ext)) {
    return `"${ext || 'sin extension'}" no es un formato valido. Usa PDF, JPG, PNG o Word.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `El archivo pesa ${mb} MB y el maximo son 10 MB. Comprimelo o toma la foto con menor calidad.`;
  }
  if (file.size === 0) {
    return 'El archivo esta vacio. Selecciona otro.';
  }
  return null;
}

export default function PortalDocumentosPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [uploadingTipo, setUploadingTipo] = useState<string | null>(null);
  const [renovando, setRenovando] = useState(false);
  const [renovado, setRenovado] = useState<string | null>(null);

  const fetchPortalData = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/documentos/${token}`);
      const json = await res.json();

      if (!res.ok) {
        if (json.expired) setExpired(true);
        else setError(json.error || 'Link invalido');
        return;
      }
      if (json.success) setData(json.data);
    } catch {
      setError('Error cargando portal');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPortalData();
  }, [fetchPortalData]);

  async function handleUpload(doc: DocumentoConLabel, file: File) {
    const errorValidacion = validarArchivo(file);
    if (errorValidacion) {
      toast.error('No pudimos subir ese archivo', { description: errorValidacion });
      return;
    }

    setUploadingTipo(doc.tipo);
    const toastId = toast.loading(`Subiendo ${doc.label}...`);

    try {
      // Paso 1: pedir URL de subida directa (request pequeño de JSON)
      const presignRes = await fetch(`/api/portal/documentos/${token}/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: doc.tipo,
          documento_id: doc.id,
          filename: file.name,
          contentType: tipoMime(file),
          fileSize: file.size,
        }),
      });
      const presignData = await presignRes.json();

      if (!presignRes.ok) {
        toast.error('No pudimos preparar la subida', {
          id: toastId,
          description: presignData.error || 'Intenta de nuevo en un momento.',
        });
        return;
      }

      // Sin S3 configurado (dev): subida clasica por FormData
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
          toast.error('No pudimos subir el archivo', {
            id: toastId,
            description: json.error || 'Intenta de nuevo.',
          });
          return;
        }
        toast.success(`${doc.label} recibido`, { id: toastId });
        await fetchPortalData();
        return;
      }

      // Paso 2: subida directa al almacenamiento (evita el limite de 4.5MB)
      const uploadRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': tipoMime(file) },
        body: file,
      });

      if (!uploadRes.ok) {
        toast.error('Falló la subida del archivo', {
          id: toastId,
          description: 'Revisa tu conexion e intenta de nuevo.',
        });
        return;
      }

      // Paso 3: confirmar en el servidor
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
        toast.error('El archivo subio pero no quedo registrado', {
          id: toastId,
          description: confirmData.error || 'Vuelve a intentarlo.',
        });
        return;
      }

      toast.success(`${doc.label} recibido`, { id: toastId });
      await fetchPortalData();
    } catch {
      toast.error('Error de conexion', {
        id: toastId,
        description: 'Verifica tu internet e intenta de nuevo.',
      });
    } finally {
      setUploadingTipo(null);
    }
  }

  async function handleRenovar() {
    setRenovando(true);
    try {
      const res = await fetch(`/api/portal/documentos/${token}/renovar`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        setRenovado(json.data?.email_destino || null);
      } else {
        toast.error('No pudimos generar un link nuevo', {
          description: json.error || 'Contacta al equipo de recursos humanos.',
        });
      }
    } catch {
      toast.error('Error de conexion', { description: 'Intenta de nuevo en un momento.' });
    } finally {
      setRenovando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal mb-4" />
        <p className="text-muted-foreground">Cargando tus documentos...</p>
      </div>
    );
  }

  // Link vencido: antes era un callejon sin salida ("contacta a RRHH").
  // Ahora el propio candidato puede pedir uno nuevo a su correo.
  if (expired) {
    return (
      <Card>
        <CardContent className="text-center py-12 px-6">
          {renovado ? (
            <>
              <MailCheck className="h-12 w-12 text-success mx-auto mb-4" />
              <h1 className="text-xl font-bold text-navy mb-2">Revisa tu correo</h1>
              <p className="text-muted-foreground text-sm">
                Te enviamos un link nuevo a <strong>{renovado}</strong>. Puede tardar un
                par de minutos en llegar; revisa tambien la carpeta de spam.
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="h-12 w-12 text-orange mx-auto mb-4" />
              <h1 className="text-xl font-bold text-navy mb-2">Este link ya vencio</h1>
              <p className="text-muted-foreground text-sm mb-6">
                Por seguridad los links caducan. Podemos enviarte uno nuevo a tu correo
                registrado. Los documentos que ya habias subido siguen guardados.
              </p>
              <Button onClick={handleRenovar} disabled={renovando} className="gap-2">
                {renovando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {renovando ? 'Enviando...' : 'Enviarme un link nuevo'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="text-center py-12 px-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-navy mb-2">Link invalido</h1>
          <p className="text-muted-foreground text-sm">
            {error || 'No encontramos este proceso.'} Si crees que es un error,
            responde al correo que recibiste.
          </p>
        </CardContent>
      </Card>
    );
  }

  // El progreso se mide solo sobre lo OBLIGATORIO: incluir los opcionales hacia
  // que el candidato viera "3 de 7" y creyera que le faltaba trabajo cuando en
  // realidad ya habia terminado.
  const obligatorios = data.documentos.filter((d) => d.requerido);
  const obligatoriosListos = obligatorios.filter(
    (d) => d.estado === 'subido' || d.estado === 'verificado'
  ).length;
  const progressPercent =
    obligatorios.length > 0
      ? Math.round((obligatoriosListos / obligatorios.length) * 100)
      : 100;

  const opcionales = data.documentos.filter((d) => !d.requerido);
  const rechazados = data.documentos.filter((d) => d.estado === 'rechazado');
  // `data.completo` es la definicion del backend, la misma que decide si el
  // pipeline avanza. Derivar aqui una tercera definicion producia pantallas
  // contradictorias (barra al 100% con el aviso de "necesitamos estos
  // documentos" y la lista vacia).
  const todoListo = data.completo || (obligatorios.length > 0 && obligatoriosListos === obligatorios.length);

  return (
    <div>
      {/* Header */}
      <div className="bg-navy text-white rounded-t-lg px-6 py-5 text-center">
        <h1 className="text-xl font-bold">{data.empresa.nombre}</h1>
        <p className="text-white/70 text-sm mt-0.5">{data.vacante.titulo}</p>
      </div>

      <div className="bg-white rounded-b-lg border border-t-0 p-6 mb-5">
        {todoListo ? (
          <div className="text-center py-2">
            <PartyPopper className="h-12 w-12 text-success mx-auto mb-3" />
            <h2 className="text-xl font-bold text-navy mb-2">
              Listo, {data.candidato.nombre.split(' ')[0]}. No tienes nada pendiente.
            </h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Recibimos todos tus documentos obligatorios. El equipo de{' '}
              {data.empresa.nombre} los esta revisando y te contactara con los
              siguientes pasos. <strong>No necesitas hacer nada mas.</strong>
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-navy mb-1">
              Hola, {data.candidato.nombre.split(' ')[0]}
            </h2>
            <p className="text-muted-foreground text-sm mb-3">
              Felicidades por tu seleccion para <strong>{data.vacante.titulo}</strong>.
              Para continuar necesitamos estos documentos.
            </p>
            <p className="text-xs text-muted-foreground bg-soft-gray rounded-md px-3 py-2">
              Puedes subirlos desde el celular. Foto o PDF, hasta 10 MB cada uno.
              No tienes que subirlos todos de una vez: <strong>tu avance queda
              guardado</strong> y puedes volver con este mismo link.
            </p>
          </>
        )}
      </div>

      {/* Aviso destacado si hay documentos rechazados */}
      {rechazados.length > 0 && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5">
          <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-red-800">
              {rechazados.length === 1
                ? 'Un documento necesita ser reemplazado'
                : `${rechazados.length} documentos necesitan ser reemplazados`}
            </p>
            <p className="text-red-700 text-xs mt-0.5">
              Revisa el motivo debajo de cada uno y sube una version nueva.
            </p>
          </div>
        </div>
      )}

      {/* Progreso — sin obligatorios no hay nada que medir */}
      {!todoListo && obligatorios.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Documentos obligatorios</span>
            <span className="font-medium text-navy">
              {obligatoriosListos} de {obligatorios.length}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}

      {/* Obligatorios */}
      <div className="space-y-3">
        {obligatorios.length > 0 && !todoListo && (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Obligatorios
          </p>
        )}
        {obligatorios.map((doc) => (
          <DocumentoItem
            key={doc.tipo}
            doc={doc}
            uploading={uploadingTipo === doc.tipo}
            bloqueado={uploadingTipo !== null && uploadingTipo !== doc.tipo}
            onUpload={handleUpload}
          />
        ))}
      </div>

      {/* Opcionales, separados para que no compitan con lo obligatorio */}
      {opcionales.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Opcionales
          </p>
          <div className="space-y-3">
            {opcionales.map((doc) => (
              <DocumentoItem
                key={doc.tipo}
                doc={doc}
                uploading={uploadingTipo === doc.tipo}
                bloqueado={uploadingTipo !== null && uploadingTipo !== doc.tipo}
                onUpload={handleUpload}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentoItem({
  doc,
  uploading,
  bloqueado,
  onUpload,
}: {
  doc: DocumentoConLabel;
  uploading: boolean;
  bloqueado: boolean;
  onUpload: (doc: DocumentoConLabel, file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const config = ESTADO_CONFIG[doc.estado] || ESTADO_CONFIG.pendiente;

  const yaSubido = doc.estado === 'subido' || doc.estado === 'verificado';
  // El candidato puede reemplazar lo que ya subio mientras no este aprobado.
  // Antes solo se permitia subir en 'pendiente' o 'rechazado': si mandaba el
  // archivo equivocado quedaba atrapado y terminaba escribiendo a RRHH.
  const puedeSubir = doc.estado !== 'verificado' && !bloqueado;

  function seleccionar(files: FileList | null) {
    const file = files?.[0];
    if (file && puedeSubir) onUpload(doc, file);
  }

  return (
    <Card
      className={cn(
        'transition-colors',
        doc.estado === 'rechazado' && 'border-red-200 bg-red-50/30',
        doc.estado === 'verificado' && 'border-green-200 bg-green-50/20',
        arrastrando && 'border-teal border-2 bg-teal/5',
        bloqueado && 'opacity-60'
      )}
      onDragOver={(e) => {
        if (!puedeSubir) return;
        e.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        if (!puedeSubir) return;
        e.preventDefault();
        setArrastrando(false);
        seleccionar(e.dataTransfer.files);
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('mt-0.5 shrink-0', config.color)}>{config.icon}</div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="font-medium text-sm text-navy">{doc.label}</p>
              {doc.requerido && (
                <span className="text-[10px] font-medium text-orange bg-orange/10 px-1.5 py-0.5 rounded">
                  Obligatorio
                </span>
              )}
              <span className={cn('text-[10px] font-medium', config.color)}>
                {config.label}
              </span>
            </div>

            {doc.descripcion && (
              <p className="text-xs text-muted-foreground">{doc.descripcion}</p>
            )}

            {doc.estado === 'rechazado' && doc.nota_rechazo && (
              <p className="text-xs text-red-600 mt-1.5 flex items-start gap-1">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  <strong>Motivo:</strong> {doc.nota_rechazo}
                </span>
              </p>
            )}

            {yaSubido && doc.nombre_archivo && (
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1 truncate">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{doc.nombre_archivo}</span>
              </p>
            )}

            {doc.estado === 'verificado' && (
              <p className="text-xs text-green-700 mt-1">
                Aprobado por el equipo. No necesitas hacer nada mas con este documento.
              </p>
            )}
          </div>

          <div className="shrink-0">
            {puedeSubir && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_ATTR}
                  className="hidden"
                  onChange={(e) => {
                    seleccionar(e.target.files);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant={doc.estado === 'rechazado' ? 'destructive' : yaSubido ? 'ghost' : 'outline'}
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Subiendo
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      {doc.estado === 'rechazado' ? 'Reemplazar' : yaSubido ? 'Cambiar' : 'Subir'}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
