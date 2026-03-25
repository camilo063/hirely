'use client';
import { useS3Url } from '@/hooks/use-s3-url';
import { FileText, Download, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface S3DocumentViewerProps {
  s3Key: string | null | undefined;
  fileName?: string;
  mode?: 'preview' | 'download-only';
  className?: string;
}

export function S3DocumentViewer({
  s3Key,
  fileName = 'Documento',
  mode = 'preview',
  className,
}: S3DocumentViewerProps) {
  const { url, loading, error } = useS3Url(s3Key);

  if (!s3Key) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="h-4 w-4" />
        <span>Sin documento</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Cargando documento...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span>Error al cargar: {error}</span>
      </div>
    );
  }

  const isImage = s3Key.match(/\.(jpg|jpeg|png|webp|gif)$/i);
  const isPdf = s3Key.match(/\.pdf$/i);

  return (
    <div className={className}>
      {mode === 'preview' && url && (
        <div className="mb-3">
          {isImage && (
            <img
              src={url}
              alt={fileName}
              className="max-w-full max-h-64 rounded-lg border object-contain"
            />
          )}
          {isPdf && (
            <iframe
              src={url}
              className="w-full h-96 rounded-lg border"
              title={fileName}
            />
          )}
        </div>
      )}

      {url && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Ver {fileName}
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={url} download={fileName}>
              <Download className="h-4 w-4 mr-1" />
              Descargar
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
