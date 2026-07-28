'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, Unplug, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGoogleCalendar } from '@/hooks/use-google-calendar';
import { toast } from 'sonner';

export function GoogleCalendarConnectButton() {
  const { status, loading, disconnect } = useGoogleCalendar();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = () => {
    window.location.href = '/api/auth/google';
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const result = await disconnect();
      if (result.success) {
        toast.success('Google Calendar desconectado');
      } else {
        toast.error(result.error || 'Error desconectando Google Calendar');
      }
    } catch {
      toast.error('Error desconectando Google Calendar');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-[#4285F4]" />
            <div>
              <p className="font-medium text-sm">Google Calendar</p>
              <p className="text-xs text-muted-foreground">Agendamiento de entrevistas con link de Meet</p>
            </div>
          </div>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (status.conectado) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-[#4285F4]" />
            <div>
              <p className="font-medium text-sm">Google Calendar</p>
              <p className="text-xs text-muted-foreground">Agendamiento de entrevistas con link de Meet</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs font-medium">{status.email}</p>
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
          <Calendar className="h-5 w-5 text-[#4285F4]" />
          <div>
            <p className="font-medium text-sm">Google Calendar</p>
            <p className="text-xs text-muted-foreground">Agendamiento de entrevistas con link de Meet</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">No conectado</span>
          <Button
            size="sm"
            className="bg-[#4285F4] hover:bg-[#3367D6] text-white"
            onClick={handleConnect}
          >
            <Calendar className="h-3 w-3 mr-1" />
            Conectar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
