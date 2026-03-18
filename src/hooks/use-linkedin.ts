'use client';

import { useState, useEffect, useCallback } from 'react';
import { LinkedInConnectionStatus } from '@/lib/types/linkedin.types';

export function useLinkedIn() {
  const [status, setStatus] = useState<LinkedInConnectionStatus>({
    connected: false,
    name: null,
    email: null,
    picture: null,
    expires_at: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/linkedin/status');
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
    const res = await fetch('/api/linkedin/disconnect', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setStatus({ connected: false, name: null, email: null, picture: null, expires_at: null });
    }
    return data;
  };

  return { status, loading, disconnect, refetch: fetchStatus };
}
