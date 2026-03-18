'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, Linkedin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { LinkedInPublishResult } from '@/lib/types/linkedin.types';

interface LinkedInPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: LinkedInPublishResult;
}

export function LinkedInPublishModal({ isOpen, onClose, result }: LinkedInPublishModalProps) {
  const [copiedDesc, setCopiedDesc] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [editableContent, setEditableContent] = useState(
    result.clipboardContent || result.previewContent?.description || ''
  );

  const preview = result.previewContent;

  async function handleCopyTitle() {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview.title);
      setCopiedTitle(true);
      toast.success('Titulo copiado — pegalo en el campo "Cargo" de LinkedIn');
      setTimeout(() => setCopiedTitle(false), 3000);
    } catch {
      toast.error('Error al copiar titulo');
    }
  }

  async function handleCopyAndOpen() {
    try {
      await navigator.clipboard.writeText(editableContent);
      setCopiedDesc(true);
      toast.success('Descripcion copiada al portapapeles');

      setTimeout(() => {
        if (result.deepLinkUrl) {
          window.open(result.deepLinkUrl, '_blank', 'noopener,noreferrer');
        }
        onClose();
      }, 800);
    } catch {
      toast.error('Error al copiar al portapapeles');
    }
  }

  async function handleCopyDescOnly() {
    try {
      await navigator.clipboard.writeText(editableContent);
      setCopiedDesc(true);
      toast.success('Descripcion copiada');
      setTimeout(() => setCopiedDesc(false), 2000);
    } catch {
      toast.error('Error al copiar');
    }
  }

  if (!preview) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-[#0A66C2]" />
            Publicar en LinkedIn
          </DialogTitle>
          <DialogDescription>
            Revisa el contenido de tu vacante. Copia el titulo y la descripcion
            por separado para pegarlos en LinkedIn.
          </DialogDescription>
        </DialogHeader>

        {/* Title with copy button */}
        <div className="space-y-3 p-4 bg-soft-gray rounded-lg">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Cargo (copiar al campo &quot;Cargo&quot; de LinkedIn)
              </p>
              <p className="text-lg font-semibold text-navy">{preview.title}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyTitle}
              className="gap-1.5 shrink-0"
            >
              {copiedTitle ? <Check className="h-3.5 w-3.5 text-teal" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedTitle ? 'Copiado' : 'Copiar titulo'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{preview.location}</Badge>
            <Badge variant="outline" className="capitalize">
              {preview.workplaceType === 'REMOTE' ? 'Remoto' :
               preview.workplaceType === 'HYBRID' ? 'Hibrido' : 'Presencial'}
            </Badge>
            <Badge variant="outline">
              {preview.employmentType === 'FULL_TIME' ? 'Tiempo completo' :
               preview.employmentType === 'CONTRACT' ? 'Prestacion de servicios' : 'Por horas'}
            </Badge>
            {preview.salaryRange && (
              <Badge variant="outline">{preview.salaryRange}</Badge>
            )}
          </div>

          {preview.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {preview.skills.map((skill, i) => (
                <Badge key={i} className="bg-teal/10 text-teal border-teal/20">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Editable Description */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Descripcion (copiar al campo &quot;Descripcion&quot; de LinkedIn)</p>
            <Button variant="ghost" size="sm" onClick={handleCopyDescOnly} className="gap-1.5">
              {copiedDesc ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedDesc ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
          <textarea
            value={editableContent}
            onChange={(e) => setEditableContent(e.target.value)}
            rows={12}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                       ring-offset-background placeholder:text-muted-foreground
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal
                       focus-visible:ring-offset-2 resize-y font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Puedes editar el texto antes de copiar.
          </p>
        </div>

        <Separator />

        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
          <p className="font-medium text-navy mb-1.5">Pasos en LinkedIn:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Haz clic en <strong>&quot;Copiar descripcion y abrir LinkedIn&quot;</strong></li>
            <li>En LinkedIn, reemplaza el campo <strong>&quot;Cargo&quot;</strong> con el titulo de tu vacante (usa <strong>&quot;Copiar titulo&quot;</strong> arriba)</li>
            <li>Haz clic en <strong>&quot;Escribir por mi cuenta&quot;</strong></li>
            <li>Pega la descripcion en el campo correspondiente (<kbd className="px-1 py-0.5 bg-white rounded border text-xs">Ctrl+V</kbd>)</li>
            <li>Completa ubicacion, tipo de empleo y publica</li>
          </ol>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleCopyAndOpen}
            className="bg-[#0A66C2] hover:bg-[#004182] text-white gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Copiar descripcion y abrir LinkedIn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
