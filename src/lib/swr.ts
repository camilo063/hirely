import type { SWRConfiguration } from 'swr';

/**
 * Cliente SWR para listas y datos interactivos (nivel "caliente").
 *
 * SWR mantiene un cache en memoria por pestaña keyed por URL: navegar y volver
 * no re-dispara el fetch (dedupe), y revalida en background. Complementa al
 * cache de servidor (Redis): aqui el objetivo es UX instantanea + menos
 * refetches redundantes del MISMO usuario.
 *
 * Para "alguien aplico -> refrescar la lista":
 *  - Actor externo (portal): `revalidateOnFocus` refresca al volver a la
 *    pestaña. Para algo casi-vivo, pasar `refreshInterval` en el hook puntual.
 *  - Accion in-app (cambio de estado, etc.): tras el PATCH, llamar `mutate()`
 *    de la lista para revalidar al instante.
 */

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${url}`);
  return res.json();
};

export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: true,   // al volver a la pestaña, refresca (cubre applies externos)
  dedupingInterval: 5000,    // colapsa requests identicos dentro de 5s
  keepPreviousData: true,    // navegacion/paginacion sin parpadeo
  errorRetryCount: 2,
};
