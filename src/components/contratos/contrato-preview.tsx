'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Printer, Download, Send, Loader2, Eye } from 'lucide-react';
import { ContratoConDetalles, ESTADO_CONTRATO_LABELS, EstadoContrato } from '@/lib/types/contrato.types';
import { useTiposContrato } from '@/hooks/useTiposContrato';

interface Props {
  contrato: ContratoConDetalles;
  onEstadoChange?: (contrato: ContratoConDetalles) => void;
}

export function ContratoPreview({ contrato, onEstadoChange }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [sendLoading, setSendLoading] = useState(false);

  const { getTipoLabel } = useTiposContrato();
  const estadoInfo = ESTADO_CONTRATO_LABELS[contrato.estado as EstadoContrato] || {
    label: contrato.estado,
    color: 'bg-gray-100 text-gray-600',
  };
  const tipoLabel = getTipoLabel(contrato.tipo);

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Contrato - ${contrato.candidato_nombre}</title>
  <style>
    @page { margin: 20mm; size: A4; }
    body { margin: 0; padding: 0; background: white; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>${contrato.contenido_html || '<p>Sin contenido</p>'}</body>
</html>`);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.print();
    }, 300);
  };

  const handleDownloadHtml = () => {
    const htmlCompleto = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Contrato - ${contrato.candidato_nombre || 'Candidato'}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
    @page { margin: 20mm; size: A4; }
    body { background: white; margin: 0; padding: 0; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  <div class="no-print" style="background:#0A1F3F;color:white;padding:12px 20px;font-family:sans-serif;font-size:13px;text-align:center;">
    Para guardar como PDF: usa Ctrl+P (o Cmd+P) → "Guardar como PDF"
  </div>
  ${contrato.contenido_html || '<p>Sin contenido</p>'}
</body>
</html>`;
    const blob = new Blob([htmlCompleto], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contrato_${contrato.candidato_nombre?.replace(/\s/g, '_')}_v${contrato.version || 1}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEnviarFirma = async () => {
    setSendLoading(true);
    try {
      const res = await fetch(`/api/contratos/${contrato.id}/firmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'docusign' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success('Contrato enviado para firma');
      onEstadoChange?.({ ...contrato, estado: 'enviado' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSendLoading(false);
    }
  };

  const handleMarcarGenerado = async () => {
    try {
      const res = await fetch(`/api/contratos/${contrato.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'generado' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success('Contrato marcado como generado');
      onEstadoChange?.(data.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <Card>
        <CardContent className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className={estadoInfo.color}>{estadoInfo.label}</Badge>
            <span className="text-sm text-muted-foreground">{tipoLabel}</span>
            {contrato.version && (
              <Badge variant="secondary" className="text-xs">v{contrato.version}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadHtml}>
              <Download className="h-4 w-4 mr-1" /> Descargar
            </Button>
            {contrato.estado === 'borrador' && (
              <Button size="sm" variant="outline" onClick={handleMarcarGenerado}>
                <Eye className="h-4 w-4 mr-1" /> Marcar como generado
              </Button>
            )}
            {(contrato.estado === 'borrador' || contrato.estado === 'generado') && (
              <Button
                size="sm"
                onClick={handleEnviarFirma}
                disabled={sendLoading}
                className="bg-teal hover:bg-teal/90 text-white"
              >
                {sendLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Enviar para firma
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Vista previa del documento</CardTitle>
        </CardHeader>
        <CardContent>
          {contrato.contenido_html ? (
            <div
              className="border rounded-lg p-8 bg-white min-h-[600px] shadow-inner"
              dangerouslySetInnerHTML={{ __html: contrato.contenido_html }}
            />
          ) : (
            <div className="border rounded-lg p-8 bg-muted/20 min-h-[200px] flex items-center justify-center">
              <p className="text-muted-foreground">Sin contenido HTML generado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden iframe for printing */}
      <iframe ref={iframeRef} className="hidden" title="print-frame" />
    </div>
  );
}
