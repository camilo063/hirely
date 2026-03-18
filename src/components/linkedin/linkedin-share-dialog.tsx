'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { LinkedInIcon } from '@/components/icons/linkedin-icon';
import { toast } from 'sonner';

interface LinkedInShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vacanteId: string;
  defaultContent: string;
  onSuccess?: () => void;
}

export function LinkedInShareDialog({
  open,
  onOpenChange,
  vacanteId,
  defaultContent,
  onSuccess,
}: LinkedInShareDialogProps) {
  const [content, setContent] = useState(defaultContent);
  const [publishing, setPublishing] = useState(false);

  const charCount = content.length;
  const isValid = charCount >= 10 && charCount <= 3000;

  const handlePublish = async () => {
    if (!isValid) return;

    setPublishing(true);
    try {
      const res = await fetch(`/api/vacantes/${vacanteId}/publicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, visibility: 'PUBLIC' }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Vacante publicada en LinkedIn');
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(data.error || 'Error publicando en LinkedIn');
      }
    } catch {
      toast.error('Error publicando en LinkedIn');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkedInIcon className="h-5 w-5 text-[#0A66C2]" />
            Publicar en LinkedIn
          </DialogTitle>
          <DialogDescription>
            Edita el contenido del post antes de publicarlo en LinkedIn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Contenido del post</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="Escribe el contenido del post..."
              className="resize-none"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {charCount < 10 && 'Minimo 10 caracteres'}
                {charCount > 3000 && 'Maximo 3000 caracteres'}
              </span>
              <span className={charCount > 3000 ? 'text-red-500' : ''}>
                {charCount} / 3000
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            Cancelar
          </Button>
          <Button
            className="bg-[#0A66C2] hover:bg-[#004182] text-white"
            onClick={handlePublish}
            disabled={!isValid || publishing}
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
