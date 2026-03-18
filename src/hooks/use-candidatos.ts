import { useState, useEffect, useCallback } from 'react';
import { Candidato, CandidatoFilters } from '@/lib/types/candidato.types';
import { useDebounce } from './use-debounce';

export function useCandidatos(initialFilters?: CandidatoFilters) {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialFilters?.search || '');
  const [habilidad, setHabilidad] = useState(initialFilters?.habilidad || '');
  const debouncedSearch = useDebounce(search, 300);

  const fetchCandidatos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (habilidad) params.set('habilidad', habilidad);

      const res = await fetch(`/api/candidatos?${params}`);
      const data = await res.json();
      if (data.success) {
        setCandidatos(data.data.data || []);
        setTotal(data.data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching candidatos:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, habilidad, page]);

  useEffect(() => {
    fetchCandidatos();
  }, [fetchCandidatos]);

  return {
    candidatos, total, page, loading,
    search, setSearch, habilidad, setHabilidad,
    setPage, refetch: fetchCandidatos,
  };
}
