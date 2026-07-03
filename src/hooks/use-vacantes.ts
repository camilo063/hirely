import { useState } from 'react';
import useSWR from 'swr';
import { VacanteWithStats, VacanteFilters } from '@/lib/types/vacante.types';
import { useDebounce } from './use-debounce';
import { fetcher, swrConfig } from '@/lib/swr';

export function useVacantes(initialFilters?: VacanteFilters) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(initialFilters?.search || '');
  const [estado, setEstado] = useState(initialFilters?.estado || '');
  const debouncedSearch = useDebounce(search, 300);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (estado) params.set('estado', estado);
  const key = `/api/vacantes?${params.toString()}`;

  const { data, isLoading, mutate } = useSWR(key, fetcher, swrConfig);

  const payload = data?.success ? data.data : undefined;

  return {
    vacantes: (payload?.data ?? []) as VacanteWithStats[],
    total: payload?.total ?? 0,
    page,
    loading: isLoading,
    search,
    setSearch,
    estado,
    setEstado,
    setPage,
    // refetch/mutate revalidan esta lista al instante (usar tras acciones in-app).
    refetch: () => mutate(),
    mutate,
  };
}
