'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LinkedInIcon } from '@/components/icons/linkedin-icon';
import { useLinkedIn } from '@/hooks/use-linkedin';
import { toast } from 'sonner';

export function LinkedInConnectButton() {
  const { status, loading, disconnect } = useLinkedIn();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = () => {
    window.location.href = '/api/linkedin';
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const result = await disconnect();
      if (result.success) {
        toast.success('LinkedIn desconectado');
      } else {
        toast.error(result.error || 'Error desconectando LinkedIn');
      }
    } catch {
      toast.error('Error desconectando LinkedIn');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LinkedInIcon className="h-5 w-5 text-[#0A66C2]" />
            <div>
              <p className="font-medium text-sm">LinkedIn</p>
              <p className="text-xs text-muted-foreground">Publicacion de vacantes en LinkedIn</p>
            </div>
          </div>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (status.connected) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LinkedInIcon className="h-5 w-5 text-[#0A66C2]" />
            <div>
              <p className="font-medium text-sm">LinkedIn</p>
              <p className="text-xs text-muted-foreground">Publicacion de vacantes en LinkedIn</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {status.picture && (
                <img
                  src={status.picture}
                  alt={status.name || 'LinkedIn'}
                  className="h-6 w-6 rounded-full"
                />
              )}
              <div className="text-right">
                <p className="text-xs font-medium">{status.name}</p>
                <p className="text-xs text-muted-foreground">{status.email}</p>
              </div>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Unplug className="h-3 w-3 mr-1" />
              )}
              Desconectar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LinkedInIcon className="h-5 w-5 text-[#0A66C2]" />
          <div>
            <p className="font-medium text-sm">LinkedIn</p>
            <p className="text-xs text-muted-foreground">Publicacion de vacantes en LinkedIn</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">No conectado</span>
          <Button
            size="sm"
            className="bg-[#0A66C2] hover:bg-[#004182] text-white"
            onClick={handleConnect}
          >
            <LinkedInIcon className="h-3 w-3 mr-1" />
            Conectar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
