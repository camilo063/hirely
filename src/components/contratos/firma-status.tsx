import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileSignature, Send, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FirmaStatusProps {
  estado: string;
  firmaUrl: string | null;
  firmadoAt: string | null;
  onEnviarFirma?: () => void;
  onConfirmarFirma?: () => void;
  loading?: boolean;
}

const estadoConfig: Record<string, { icon: typeof Clock; label: string; color: string }> = {
  borrador: { icon: Clock, label: 'Borrador', color: 'bg-gray-100 text-gray-700' },
  generado: { icon: FileSignature, label: 'Generado', color: 'bg-blue-100 text-blue-700' },
  enviado: { icon: Send, label: 'Enviado para firma', color: 'bg-orange-100 text-orange-700' },
  firmado: { icon: CheckCircle, label: 'Firmado', color: 'bg-success/10 text-success' },
  rechazado: { icon: XCircle, label: 'Rechazado', color: 'bg-destructive/10 text-destructive' },
};

export function FirmaStatus({ estado, firmaUrl, firmadoAt, onEnviarFirma, onConfirmarFirma, loading }: FirmaStatusProps) {
  const config = estadoConfig[estado] || estadoConfig.borrador;
  const EstadoIcon = config.icon;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-teal/10 flex items-center justify-center">
              <FileSignature className="h-5 w-5 text-teal" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado de la firma</p>
              <Badge className={cn('mt-1', config.color)}>
                <EstadoIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
            </div>
          </div>

          {(estado === 'borrador' || estado === 'generado') && onEnviarFirma && (
            <Button onClick={onEnviarFirma} className="bg-teal hover:bg-teal/90 text-white" disabled={loading}>
              <Send className="h-4 w-4 mr-2" />
              {loading ? 'Enviando...' : 'Enviar para firma'}
            </Button>
          )}

          {estado === 'enviado' && onConfirmarFirma && (
            <Button onClick={onConfirmarFirma} className="bg-success hover:bg-success/90 text-white" disabled={loading}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar: ambas partes han firmado
            </Button>
          )}
        </div>

        {firmaUrl && estado === 'enviado' && (
          <div className="mt-4 p-3 bg-soft-gray rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Link de firma:</p>
            <a href={firmaUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-teal hover:underline break-all">
              {firmaUrl}
            </a>
          </div>
        )}

        {firmadoAt && (
          <p className="mt-3 text-sm text-muted-foreground">
            Firmado el: {new Date(firmadoAt).toLocaleDateString('es-CO', { dateStyle: 'long' })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
