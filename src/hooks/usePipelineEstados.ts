'use client';

import { useState, useEffect } from 'react';
import { PIPELINE_STATES_CONFIG, PipelineState } from '@/lib/constants/pipeline-states';

/**
 * Carga el catalogo de estados del pipeline de la organizacion (con overrides
 * de label/orden/activo aplicados). Si el fetch falla, cae al catalogo default.
 *
 * El resultado se cachea a nivel de modulo: la tabla de candidatos monta un
 * selector por fila, y sin cache cada uno dispararia un fetch identico. Con
 * cache + dedupe de peticiones en vuelo, todas las filas comparten una sola.
 */
let cache: PipelineState[] | null = null;
let inflight: Promise<PipelineState[]> | null = null;
const subscribers = new Set<(e: PipelineState[]) => void>();

async function loadEstados(force = false): Promise<PipelineState[]> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch('/api/configuracion/pipeline-estados');
      if (res.ok) {
        const { data } = await res.json();
        cache = data?.estados?.length ? data.estados : PIPELINE_STATES_CONFIG;
      } else {
        cache = PIPELINE_STATES_CONFIG;
      }
    } catch {
      cache = PIPELINE_STATES_CONFIG;
    } finally {
      inflight = null;
    }
    subscribers.forEach((cb) => cb(cache as PipelineState[]));
    return cache as PipelineState[];
  })();

  return inflight;
}

/** Fuerza recargar el catalogo (invalida cache) y notifica a los hooks montados. */
export function refreshPipelineEstados() {
  loadEstados(true);
}

export function usePipelineEstados() {
  const [estados, setEstados] = useState<PipelineState[]>(cache ?? PIPELINE_STATES_CONFIG);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    const cb = (e: PipelineState[]) => setEstados(e);
    subscribers.add(cb);
    if (cache) {
      setEstados(cache);
      setLoading(false);
    } else {
      loadEstados().then(() => setLoading(false));
    }
    return () => { subscribers.delete(cb); };
  }, []);

  const refetch = () => { loadEstados(true); };

  return { estados, loading, refetch };
}
