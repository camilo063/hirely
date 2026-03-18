import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './use-debounce';
import type {
  FiltrosReporte,
  KPIsGenerales,
  FunnelData,
  TiemposPorEtapa,
  VolumenSemana,
  TopVacante,
} from '@/lib/types/reportes.types';

interface ReportesState {
  kpis: KPIsGenerales | null;
  funnel: FunnelData | null;
  tiempos: TiemposPorEtapa | null;
  volumen: VolumenSemana[];
  topVacantes: TopVacante[];
  scores: { rango: string; candidatos: number; label: string }[];
  loading: boolean;
  error: string | null;
}

function buildParams(filtros: FiltrosReporte): string {
  const params = new URLSearchParams();
  if (filtros.periodo) params.set('periodo', filtros.periodo);
  if (filtros.vacanteId) params.set('vacanteId', filtros.vacanteId);
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);
  return params.toString();
}

export function useReportes(initialFiltros?: FiltrosReporte) {
  const [filtros, setFiltros] = useState<FiltrosReporte>(initialFiltros || { periodo: '90d' });
  const [state, setState] = useState<ReportesState>({
    kpis: null,
    funnel: null,
    tiempos: null,
    volumen: [],
    topVacantes: [],
    scores: [],
    loading: true,
    error: null,
  });

  const debouncedDesde = useDebounce(filtros.desde || '', 300);
  const debouncedHasta = useDebounce(filtros.hasta || '', 300);

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const effectiveFiltros = { ...filtros, desde: debouncedDesde || undefined, hasta: debouncedHasta || undefined };
    const qs = buildParams(effectiveFiltros);

    try {
      const [kpisRes, funnelRes, tiemposRes, volumenRes, topRes, scoresRes] = await Promise.all([
        fetch('/api/reportes/kpis'),
        fetch(`/api/reportes/funnel?${qs}`),
        fetch('/api/reportes/tiempos'),
        fetch(`/api/reportes/volumen?${qs}`),
        fetch('/api/reportes/top-vacantes'),
        fetch(`/api/reportes/scores?${qs}`),
      ]);

      const [kpisData, funnelData, tiemposData, volumenData, topData, scoresData] = await Promise.all([
        kpisRes.json(),
        funnelRes.json(),
        tiemposRes.json(),
        volumenRes.json(),
        topRes.json(),
        scoresRes.json(),
      ]);

      setState({
        kpis: kpisData.success ? kpisData.data : null,
        funnel: funnelData.success ? funnelData.data : null,
        tiempos: tiemposData.success ? tiemposData.data : null,
        volumen: volumenData.success ? volumenData.data : [],
        topVacantes: topData.success ? topData.data : [],
        scores: scoresData.success ? scoresData.data : [],
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('Error fetching reportes:', err);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Error al cargar los reportes',
      }));
    }
  }, [filtros, debouncedDesde, debouncedHasta]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    filtros,
    setFiltros,
    refetch: fetchData,
  };
}
