import { useState, useEffect, useCallback } from 'react';
import { VacanteWithStats, VacanteFilters } from '@/lib/types/vacante.types';
import { useDebounce } from './use-debounce';

export function useVacantes(initialFilters?: VacanteFilters) {
  const [vacantes, setVacantes] = useState<VacanteWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialFilters?.search || '');
  const [estado, setEstado] = useState(initialFilters?.estado || '');
  const debouncedSearch = useDebounce(search, 300);

  const fetchVacantes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (estado) params.set('estado', estado);

      const res = await fetch(`/api/vacantes?${params}`);
      const data = await res.json();
      if (data.success) {
        setVacantes(data.data.data || []);
        setTotal(data.data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching vacantes:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, estado, page]);

  useEffect(() => {
    fetchVacantes();
  }, [fetchVacantes]);

  return {
    vacantes, total, page, loading,
    search, setSearch, estado, setEstado,
    setPage, refetch: fetchVacantes,
  };
}
