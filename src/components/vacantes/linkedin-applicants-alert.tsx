'use client';

import { useState } from 'react';
import { RefreshCw, Linkedin, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface LinkedInApplicantsAlertProps {
  vacanteId: string;
  isPublishedOnLinkedIn: boolean;
}

export function LinkedInApplicantsAlert({
  vacanteId,
  isPublishedOnLinkedIn,
}: LinkedInApplicantsAlertProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ nuevos: number } | null>(null);

  if (!isPublishedOnLinkedIn) return null;

  async function handleSync() {
    setIsSyncing(true);
    try {
      const response = await fetch(`/api/vacantes/${vacanteId}/linkedin/sync`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        setSyncResult({ nuevos: data.data.nuevos });
        if (data.data.nuevos > 0) {
          toast.success(data.data.message);
          window.location.reload();
        } else {
          toast.info(data.data.message);
        }
      } else {
        toast.error(data.error || 'Error al sincronizar');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
      <div className="flex items-center gap-2 text-sm text-blue-700">
        <Linkedin className="h-4 w-4" />
        <span>Vacante publicada en LinkedIn</span>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={isSyncing}
        className="ml-auto gap-2 text-blue-700 border-blue-300 hover:bg-blue-100"
      >
        {isSyncing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {isSyncing ? 'Sincronizando...' : 'Traer candidatos de LinkedIn'}
      </Button>

      {syncResult && syncResult.nuevos > 0 && (
        <Badge className="bg-teal text-white">
          <Users className="h-3 w-3 mr-1" />
          +{syncResult.nuevos} nuevo(s)
        </Badge>
      )}
    </div>
  );
}
