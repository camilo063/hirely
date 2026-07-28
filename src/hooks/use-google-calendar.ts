'use client';

import { useState, useEffect, useCallback } from 'react';

interface GoogleCalendarStatus {
  conectado: boolean;
  email?: string;
  scopes?: string[];
}

export function useGoogleCalendar() {
  const [status, setStatus] = useState<GoogleCalendarStatus>({ conectado: false });
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/google/calendar');
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch {
      // Keep default disconnected state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const disconnect = async () => {
    const res = await fetch('/api/google/calendar', { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      setStatus({ conectado: false });
    }
    return data;
  };

  return { status, loading, disconnect, refetch: fetchStatus };
}
