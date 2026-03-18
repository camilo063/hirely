'use client';

import { useState } from 'react';
import { Copy, Check, Share2, MessageCircle, Mail, Globe } from 'lucide-react';
import { Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface CompartirVacanteProps {
  slug: string;
  vacanteTitulo: string;
  empresaNombre: string;
}

export function CompartirVacante({
  slug,
  vacanteTitulo,
  empresaNombre,
}: CompartirVacanteProps) {
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = `${baseUrl}/empleo/${slug}`;
  const shareText = `${vacanteTitulo} en ${empresaNombre}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('Enlace copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  }

  const shareChannels = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      color: 'bg-[#25D366] hover:bg-[#1DA851]',
      url: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${publicUrl}`)}`,
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'bg-[#0A66C2] hover:bg-[#004182]',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`,
    },
    {
      name: 'Email',
      icon: Mail,
      color: 'bg-gray-600 hover:bg-gray-700',
      url: `mailto:?subject=${encodeURIComponent(`Oportunidad: ${shareText}`)}&body=${encodeURIComponent(`Mira esta oportunidad laboral:\n\n${shareText}\n\nPostulate aqui: ${publicUrl}`)}`,
    },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Compartir
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartir vacante</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Public URL */}
          <div>
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Enlace publico de la vacante
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={publicUrl}
                className="text-sm font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0">
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Share channels */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Compartir en</p>
            <div className="grid grid-cols-3 gap-2">
              {shareChannels.map((ch) => (
                <a
                  key={ch.name}
                  href={ch.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-2 text-white text-sm font-medium py-2.5 rounded-lg transition-colors ${ch.color}`}
                >
                  <ch.icon className="h-4 w-4" />
                  {ch.name}
                </a>
              ))}
            </div>
          </div>

          {/* Preview link */}
          <div className="border-t pt-3">
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-teal hover:underline flex items-center gap-1.5"
            >
              <Globe className="h-3.5 w-3.5" />
              Ver pagina publica de la vacante
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
