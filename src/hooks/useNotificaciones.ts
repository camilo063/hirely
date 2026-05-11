'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  meta: Record<string, string>;
  created_at: string;
  browser_activo?: boolean;
}

interface UseNotificacionesReturn {
  notificaciones: Notificacion[];
  noLeidas: number;
  loading: boolean;
  marcarLeida: (id: string) => void;
  marcarTodasLeidas: () => void;
  permisoNavegador: NotificationPermission | null;
  solicitarPermisoNavegador: () => Promise<void>;
}

const POLL_INTERVAL_MS = 20000;
const MAX_NOTIFICACIONES = 50;

interface PollResponse {
  notificaciones: Notificacion[];
  no_leidas: number;
  timestamp: string;
}

export function useNotificaciones(): UseNotificacionesReturn {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [permisoNavegador, setPermisoNavegador] = useState<NotificationPermission | null>(null);

  const ultimoTimestampRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermisoNavegador(Notification.permission);
    }
  }, []);

  const doPoll = useCallback(async (isInitial: boolean) => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const url = isInitial || !ultimoTimestampRef.current
        ? '/api/notificaciones/poll'
        : `/api/notificaciones/poll?desde=${encodeURIComponent(ultimoTimestampRef.current)}`;

      const res = await fetch(url);
      if (!res.ok) {
        if (isInitial) setLoading(false);
        return;
      }
      const data: PollResponse = await res.json();
      ultimoTimestampRef.current = data.timestamp;

      if (isInitial) {
        setNotificaciones(data.notificaciones);
        setNoLeidas(data.no_leidas);
        setLoading(false);
        return;
      }

      if (data.notificaciones.length > 0) {
        setNotificaciones(prev => {
          const existentes = new Set(prev.map(n => n.id));
          const nuevas = data.notificaciones.filter(n => !existentes.has(n.id));
          if (nuevas.length === 0) return prev;
          return [...nuevas, ...prev].slice(0, MAX_NOTIFICACIONES);
        });

        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          data.notificaciones.forEach(n => {
            if (n.browser_activo) {
              new Notification(`Hirely — ${n.titulo}`, {
                body: n.mensaje,
                icon: '/favicon.ico',
                tag: n.id,
              });
            }
          });
        }
      }

      setNoLeidas(data.no_leidas);
    } catch (e) {
      console.error('[useNotificaciones] Error polling:', e);
      if (isInitial) setLoading(false);
    } finally {
      pollingRef.current = false;
    }
  }, []);

  const startInterval = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      doPoll(false);
    }, POLL_INTERVAL_MS);
  }, [doPoll]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    doPoll(true).then(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        startInterval();
      }
    });

    return () => {
      stopInterval();
    };
  }, [doPoll, startInterval, stopInterval]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibility = () => {
      if (document.hidden) {
        stopInterval();
      } else {
        doPoll(false);
        startInterval();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [doPoll, startInterval, stopInterval]);

  const marcarLeida = useCallback(async (id: string) => {
    setNotificaciones(prev =>
      prev.map(n => n.id === id ? { ...n, leida: true } : n)
    );
    setNoLeidas(prev => Math.max(0, prev - 1));

    try {
      await fetch('/api/notificaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch (e) {
      console.error('[useNotificaciones] Error marcando leida:', e);
    }
  }, []);

  const marcarTodasLeidas = useCallback(async () => {
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
    setNoLeidas(0);

    try {
      await fetch('/api/notificaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todas: true }),
      });
    } catch (e) {
      console.error('[useNotificaciones] Error marcando todas leidas:', e);
    }
  }, []);

  const solicitarPermisoNavegador = useCallback(async () => {
    if (!('Notification' in window)) return;
    const permiso = await Notification.requestPermission();
    setPermisoNavegador(permiso);
  }, []);

  return {
    notificaciones,
    noLeidas,
    loading,
    marcarLeida,
    marcarTodasLeidas,
    permisoNavegador,
    solicitarPermisoNavegador,
  };
}
