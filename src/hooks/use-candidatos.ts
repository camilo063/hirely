import { useState } from 'react';
import useSWR from 'swr';
import { Candidato, CandidatoFilters } from '@/lib/types/candidato.types';
import { useDebounce } from './use-debounce';
import { fetcher, swrConfig } from '@/lib/swr';

export function useCandidatos(initialFilters?: CandidatoFilters) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(initialFilters?.search || '');
  const [habilidad, setHabilidad] = useState(initialFilters?.habilidad || '');
  const debouncedSearch = useDebounce(search, 300);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (habilidad) params.set('habilidad', habilidad);
  const key = `/api/candidatos?${params.toString()}`;

  const { data, isLoading, mutate } = useSWR(key, fetcher, swrConfig);

  const payload = data?.success ? data.data : undefined;

  return {
    candidatos: (payload?.data ?? []) as Candidato[],
    total: payload?.total ?? 0,
    page,
    loading: isLoading,
    search,
    setSearch,
    habilidad,
    setHabilidad,
    setPage,
    // refetch/mutate revalidan esta lista al instante (usar tras acciones in-app).
    refetch: () => mutate(),
    mutate,
  };
}
