'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificaciones, Notificacion } from '@/hooks/useNotificaciones';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const ICONOS: Record<string, string> = {
  nueva_aplicacion:              '\uD83D\uDCCB',
  pipeline_estado_cambiado:      '\uD83D\uDCCB',
  candidato_seleccionado:        '\u2B50',
  entrevista_dapta_completada:   '\uD83C\uDFA4',
  entrevista_humana_agendada:    '\uD83D\uDCC5',
  entrevista_humana_realizada:   '\u2705',
  evaluacion_tecnica_completada: '\uD83D\uDCDD',
  documento_subido:              '\uD83D\uDCC4',
  documentos_completos:          '\uD83D\uDCC2',
  documento_rechazado:           '\u26A0\uFE0F',
  contrato_generado:             '\uD83D\uDCC3',
  contrato_enviado_firma:        '\u270D\uFE0F',
  contrato_firmado_candidato:    '\u270D\uFE0F',
  contrato_firmado_bilateral:    '\uD83C\uDF89',
  candidato_contratado:          '\uD83C\uDF89',
  onboarding_email_enviado:      '\uD83D\uDCE7',
  candidato_duplicado_alerta:    '\uD83D\uDEA8',
  vacante_publicada:             '\uD83D\uDCE2',
  portal_documentos_expirado:    '\u23F0',
  contrato_terminado:            '\uD83D\uDD34',
};

function icono(tipo: string): string {
  return ICONOS[tipo] ?? '\uD83D\uDD14';
}

function tiempoRelativo(fecha: string): string {
  try {
    return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });
  } catch {
    return '';
  }
}

export function NotificacionesCampana() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const {
    notificaciones,
    noLeidas,
    loading,
    marcarLeida,
    marcarTodasLeidas,
    permisoNavegador,
    solicitarPermisoNavegador,
  } = useNotificaciones();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (permisoNavegador === 'default') {
      setTimeout(() => solicitarPermisoNavegador(), 3000);
    }
  }, [permisoNavegador, solicitarPermisoNavegador]);

  const ultimas10 = notificaciones.slice(0, 10);

  function handleClickNotif(notif: Notificacion) {
    marcarLeida(notif.id);
    if (notif.meta?.url) {
      router.push(notif.meta.url);
    }
    setAbierto(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAbierto(prev => !prev)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-transparent hover:bg-muted hover:border-border transition-colors"
        aria-label="Notificaciones"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>

        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange text-[10px] font-medium text-white px-1">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-medium">Notificaciones</span>
            <div className="flex items-center gap-3">
              {noLeidas > 0 && (
                <button
                  onClick={marcarTodasLeidas}
                  className="text-xs text-primary hover:underline"
                >
                  Marcar todas leidas
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm text-muted-foreground">Cargando...</span>
              </div>
            )}

            {!loading && ultimas10.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <span className="text-2xl">{'\uD83D\uDD14'}</span>
                <span className="text-sm text-muted-foreground">Sin notificaciones</span>
              </div>
            )}

            {ultimas10.map(notif => (
              <button
                key={notif.id}
                onClick={() => handleClickNotif(notif)}
                className={`flex w-full gap-3 px-4 py-3 text-left border-b last:border-b-0 transition-colors hover:bg-muted/50 ${
                  !notif.leida ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                }`}
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-base ${
                  !notif.leida ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-muted'
                }`}>
                  {icono(notif.tipo)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${!notif.leida ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {notif.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{notif.mensaje}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">{tiempoRelativo(notif.created_at)}</p>
                </div>

                {!notif.leida && (
                  <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                )}
              </button>
            ))}
          </div>

          <div className="border-t px-4 py-2.5 text-center">
            <button
              onClick={() => { router.push('/notificaciones'); setAbierto(false); }}
              className="text-xs text-primary hover:underline"
            >
              Ver todas las notificaciones &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
