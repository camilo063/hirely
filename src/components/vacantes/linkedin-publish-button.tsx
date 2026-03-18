'use client';

import { useState } from 'react';
import { Linkedin, ExternalLink, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LinkedInPublishModal } from './linkedin-publish-modal';
import type { LinkedInPublishResult } from '@/lib/types/linkedin.types';

interface LinkedInPublishButtonProps {
  vacanteId: string;
  vacanteEstado: string;
  isPublishedOnLinkedIn: boolean;
  linkedinJobId?: string | null;
}

export function LinkedInPublishButton({
  vacanteId,
  vacanteEstado,
  isPublishedOnLinkedIn,
  linkedinJobId,
}: LinkedInPublishButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [publishResult, setPublishResult] = useState<LinkedInPublishResult | null>(null);

  const isDisabled = vacanteEstado === 'cerrada' || vacanteEstado === 'borrador';

  async function handlePublish() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/vacantes/${vacanteId}/linkedin`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || 'Error al publicar en LinkedIn');
        return;
      }

      const result: LinkedInPublishResult = data.data;
      setPublishResult(result);

      // Show error if publish fell back to deeplink due to a problem
      if (result.error) {
        toast.error(result.error, { duration: 8000 });
      }

      if ((result.mode === 'api' || result.mode === 'unipile') && !result.error) {
        toast.success('Vacante publicada exitosamente en LinkedIn');
        window.location.reload();
      } else {
        // deeplink mode or fallback — show manual publish modal
        setShowModal(true);
      }
    } catch {
      toast.error('Error de conexion al publicar en LinkedIn');
    } finally {
      setIsLoading(false);
    }
  }

  // Already published via API
  if (isPublishedOnLinkedIn && linkedinJobId) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-teal bg-teal/10 px-3 py-1.5 rounded-full">
          <Check className="h-4 w-4" />
          Publicada en LinkedIn
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(
            `https://www.linkedin.com/jobs/view/${linkedinJobId}`,
            '_blank'
          )}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={handlePublish}
        disabled={isDisabled || isLoading}
        className="bg-[#0A66C2] hover:bg-[#004182] text-white gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Linkedin className="h-4 w-4" />
        )}
        {isLoading ? 'Publicando...' : 'Publicar en LinkedIn'}
      </Button>

      {showModal && publishResult?.mode === 'deeplink' && (
        <LinkedInPublishModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          result={publishResult}
        />
      )}
    </>
  );
}
