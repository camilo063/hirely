'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import type { TimelineEvento } from '@/lib/services/timeline.service';

const ACTION_LABELS: Record<string, (detalle: Record<string, unknown> | null) => string> = {
  'aplicacion.cambio_estado': (d) =>
    `Cambio de estado: ${d?.estado_anterior || '—'} → ${d?.nuevo_estado || '—'}`,
  'aplicacion.seleccionado': () => 'Candidato seleccionado',
  'aplicacion.descartado': () => 'Candidato descartado',
  'aplicacion.ats_scored': () => 'Score ATS calculado',
  'aplicacion.scoring_dual_completed': () => 'Scoring dual completado',
  'aplicacion.contratado': () => 'Candidato contratado',
  'aplicacion.contratado_auto': () => 'Candidato contratado (automatico, tras firma del contrato)',
  'aplicacion.created_from_portal': () => 'Aplicacion recibida desde el portal publico',
  'evaluacion.enviada': () => 'Evaluacion tecnica enviada',
  'evaluacion.completada': () => 'Evaluacion tecnica completada',
  'entrevista_ia.completed': () => 'Entrevista IA completada',
  'documento.verificar': () => 'Documento verificado',
  'documento.rechazar': () => 'Documento rechazado',
  'contrato.enviado_para_firma': () => 'Contrato enviado a firma',
  'contrato.firmado': () => 'Contrato firmado',
  'contrato.contrato_firmado': () => 'Contrato firmado',
  'contrato.firma_rechazada': () => 'Firma de contrato rechazada',
};

function labelDe(evento: TimelineEvento): string {
  const key = `${evento.entity_type}.${evento.action}`;
  const resolver = ACTION_LABELS[key];
  return resolver ? resolver(evento.details) : `${evento.entity_type}: ${evento.action}`;
}

export function CandidatoTimeline({ aplicacionId }: { aplicacionId: string }) {
  const [eventos, setEventos] = useState<TimelineEvento[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/aplicaciones/${aplicacionId}/timeline`);
        const data = await res.json();
        if (data.success) setEventos(data.data);
      } catch {
        // Fail silently: no bloquea el resto del panel.
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [aplicacionId]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  if (!eventos || eventos.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        Sin eventos registrados todavia.
      </div>
    );
  }

  return (
    <ol className="relative border-l border-gray-200 ml-2 space-y-4">
      {eventos.map((evento, i) => (
        <li key={i} className="ml-4">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-teal" />
          <p className="text-sm font-medium text-navy">{labelDe(evento)}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(evento.created_at), { addSuffix: true, locale: es })}
            {evento.usuario_nombre ? ` · ${evento.usuario_nombre}` : ''}
          </p>
        </li>
      ))}
    </ol>
  );
}
