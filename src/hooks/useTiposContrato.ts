'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TipoContratoOption {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  is_system: boolean;
}

export function useTiposContrato() {
  const [tipos, setTipos] = useState<TipoContratoOption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTipos = useCallback(async () => {
    try {
      const res = await fetch('/api/tipos-contrato');
      if (res.ok) {
        const data = await res.json();
        setTipos(data.data || []);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTipos(); }, [fetchTipos]);

  const getTipoLabel = useCallback((slug: string): string => {
    const found = tipos.find(t => t.slug === slug);
    return found?.nombre || slug;
  }, [tipos]);

  return { tipos, loading, refetch: fetchTipos, getTipoLabel };
}
