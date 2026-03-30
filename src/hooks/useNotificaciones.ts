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

export function useNotificaciones(): UseNotificacionesReturn {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [permisoNavegador, setPermisoNavegador] = useState<NotificationPermission | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermisoNavegador(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/notificaciones/sse');
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'init') {
          const list: Notificacion[] = data.notificaciones;
          setNotificaciones(list);
          setNoLeidas(list.filter(n => !n.leida).length);
          setLoading(false);
        } else if (data.type === 'notificacion') {
          const nueva: Notificacion = data;
          setNotificaciones(prev => [nueva, ...prev].slice(0, 50));
          setNoLeidas(prev => prev + 1);

          if (
            data.browser_activo &&
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification(`Hirely — ${data.titulo}`, {
              body: data.mensaje,
              icon: '/favicon.ico',
              tag: data.id,
            });
          }
        }
      } catch (e) {
        console.error('[useNotificaciones] Error parseando SSE:', e);
      }
    };

    es.onerror = () => {
      setLoading(false);
    };

    return () => {
      esRef.current?.close();
    };
  }, []);

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
