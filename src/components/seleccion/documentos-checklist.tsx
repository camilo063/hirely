'use client';

import { useEffect, useState } from 'react';
import {
  Loader2, CheckCircle2, Clock, XCircle, ShieldCheck, FileText,
  ExternalLink, Copy, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { DocumentoConLabel } from '@/lib/types/seleccion.types';

interface Props {
  aplicacionId: string;
  portalToken?: string;
  onComplete?: () => void;
}

export function DocumentosChecklist({ aplicacionId, portalToken, onComplete }: Props) {
  const [documentos, setDocumentos] = useState<DocumentoConLabel[]>([]);
  const [completo, setCompleto] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState<{ docId: string; tipo: string } | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchDocumentos();
  }, [aplicacionId]);

  async function fetchDocumentos() {
    try {
      const res = await fetch(`/api/documentos/${aplicacionId}`);
      const data = await res.json();
      if (data.success) {
        setDocumentos(data.data.documentos || []);
        setCompleto(data.data.completo);
        setPortalUrl(data.data.portalUrl);
        if (data.data.completo) onComplete?.();
      }
    } catch {
      console.error('Error loading documents');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerificar(docId: string) {
    setActionLoading(docId);
    try {
      const res = await fetch(`/api/documentos/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'verificar' }),
      });
      if (res.ok) {
        toast.success('Documento verificado');
        await fetchDocumentos();
      }
    } catch {
      toast.error('Error verificando documento');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRechazar() {
    if (!rejectDialog || !rejectNote.trim()) return;
    setActionLoading(rejectDialog.docId);
    try {
      const res = await fetch(`/api/documentos/${rejectDialog.docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'rechazar', nota_rechazo: rejectNote }),
      });
      if (res.ok) {
        toast.success('Documento rechazado');
        setRejectDialog(null);
        setRejectNote('');
        await fetchDocumentos();
      }
    } catch {
      toast.error('Error rechazando documento');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-teal" />
      </div>
    );
  }

  if (documentos.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        <p>Sin documentos en checklist</p>
      </div>
    );
  }

  const subidos = documentos.filter(d => d.estado === 'subido' || d.estado === 'verificado').length;
  const verificados = documentos.filter(d => d.estado === 'verificado').length;
  const progressPercent = Math.round((subidos / documentos.length) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Documentos</CardTitle>
          <div className="flex items-center gap-2">
            {completo ? (
              <Badge className="bg-success/15 text-success">Completos</Badge>
            ) : (
              <Badge variant="outline">{subidos}/{documentos.length} subidos</Badge>
            )}
            {portalUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(portalUrl);
                  toast.info('Link del portal copiado');
                }}
              >
                <Copy className="h-3 w-3" />
                Copiar link
              </Button>
            )}
          </div>
        </div>
        <Progress value={progressPercent} className="h-1.5 mt-2" />
        <p className="text-xs text-muted-foreground mt-1">
          {verificados} verificado(s) de {documentos.length} total
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {documentos.map((doc) => {
          const isLoading = actionLoading === doc.id;

          return (
            <div
              key={doc.id}
              className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${
                doc.estado === 'rechazado' ? 'border-red-200 bg-red-50/30' : ''
              }`}
            >
              {/* Status icon */}
              <div className="shrink-0">
                {doc.estado === 'pendiente' && <Clock className="h-4 w-4 text-gray-400" />}
                {doc.estado === 'subido' && <CheckCircle2 className="h-4 w-4 text-blue-500" />}
                {doc.estado === 'verificado' && <ShieldCheck className="h-4 w-4 text-green-600" />}
                {doc.estado === 'rechazado' && <XCircle className="h-4 w-4 text-red-500" />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-navy truncate">
                  {doc.label}
                  {doc.requerido && <span className="text-orange text-[10px] ml-1">*</span>}
                </p>
                {doc.estado === 'rechazado' && doc.nota_rechazo && (
                  <p className="text-xs text-red-500 truncate">{doc.nota_rechazo}</p>
                )}
                {(doc.estado === 'subido' || doc.estado === 'verificado') && doc.nombre_archivo && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {doc.nombre_archivo}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="shrink-0 flex items-center gap-1">
                {doc.estado === 'subido' && doc.url && (
                  <>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal hover:text-teal/80"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-green-600"
                      onClick={() => handleVerificar(doc.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Verificar'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-500"
                      onClick={() => setRejectDialog({ docId: doc.id, tipo: doc.tipo })}
                      disabled={isLoading}
                    >
                      Rechazar
                    </Button>
                  </>
                )}
                {doc.estado === 'verificado' && (
                  <span className="text-xs text-green-600">Verificado</span>
                )}
                {doc.estado === 'pendiente' && (
                  <span className="text-xs text-gray-400">Pendiente</span>
                )}
                {doc.estado === 'rechazado' && (
                  <span className="text-xs text-red-500">Esperando re-envio</span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>

      {/* Reject dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(v) => { if (!v) setRejectDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rechazar documento</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-sm">Motivo del rechazo</Label>
            <Textarea
              placeholder="Ej: La imagen no es legible, falta un lado del documento..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleRechazar}
              disabled={!rejectNote.trim() || !!actionLoading}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
