'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Mail, Calendar, Clock, CheckCircle, AlertCircle, Loader2, Send, RefreshCw } from 'lucide-react';
import type { OnboardingCandidato } from '@/lib/types/onboarding.types';

interface Props {
  onboarding: OnboardingCandidato;
  onUpdate?: () => void;
}

export function OnboardingStatusPanel({ onboarding, onUpdate }: Props) {
  const [sending, setSending] = useState(false);

  const formatFecha = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('es-CO', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const daysUntil = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inicio = new Date(onboarding.fecha_inicio + 'T12:00:00');
    inicio.setHours(0, 0, 0, 0);
    const diff = Math.round((inicio.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    if (diff > 0) return `En ${diff} días`;
    return `Hace ${Math.abs(diff)} días`;
  };

  const handleSendEmail = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/onboarding/${onboarding.id}/enviar-email`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error();
      toast.success('Email de bienvenida enviado');
      onUpdate?.();
    } catch {
      toast.error('Error al enviar email');
    } finally {
      setSending(false);
    }
  };

  const emailEstadoBadge = () => {
    switch (onboarding.email_bienvenida_estado) {
      case 'enviado':
        return <Badge className="bg-success/15 text-success gap-1"><CheckCircle className="h-3 w-3" /> Enviado</Badge>;
      case 'programado':
        return <Badge className="bg-blue-100 text-blue-700 gap-1"><Clock className="h-3 w-3" /> Programado</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700 gap-1"><AlertCircle className="h-3 w-3" /> Error</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pendiente</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Onboarding</CardTitle>
          <Badge className="bg-success/15 text-success">Contratado</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Fecha inicio */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>Inicio: <strong>{formatFecha(onboarding.fecha_inicio)}</strong></span>
          <Badge variant="outline" className="text-xs ml-auto">{daysUntil()}</Badge>
        </div>

        {/* Email status */}
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span>Email:</span>
          {emailEstadoBadge()}
        </div>

        {onboarding.email_bienvenida_enviado_at && (
          <p className="text-xs text-muted-foreground ml-6">
            Enviado el {formatDateTime(onboarding.email_bienvenida_enviado_at)}
          </p>
        )}

        {/* Notas */}
        {onboarding.notas_onboarding && (
          <div className="bg-muted/50 rounded-md p-2 text-xs text-muted-foreground">
            {onboarding.notas_onboarding}
          </div>
        )}

        {/* Actions */}
        {(onboarding.email_bienvenida_estado === 'programado' ||
          onboarding.email_bienvenida_estado === 'error' ||
          onboarding.email_bienvenida_estado === 'pendiente') && (
          <Button size="sm" variant="outline" onClick={handleSendEmail} disabled={sending} className="w-full gap-1.5">
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Enviar email ahora
          </Button>
        )}

        {onboarding.email_bienvenida_estado === 'enviado' && (
          <Button size="sm" variant="ghost" onClick={handleSendEmail} disabled={sending} className="w-full gap-1.5 text-muted-foreground">
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Re-enviar email
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
