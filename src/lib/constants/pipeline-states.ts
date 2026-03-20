/**
 * Pipeline state machine with prerequisites.
 * Each state defines which previous states must have been completed
 * before a candidate can transition into it.
 */

export interface PipelineState {
  key: string;
  label: string;
  color: string; // tailwind class
  orden: number;
  prerequisitos: string[];
  descripcion: string;
  automatico?: boolean;
}

export interface TransicionInfo {
  state: PipelineState;
  permitida: boolean;
  razon?: string;
  completado: boolean;
}

export const PIPELINE_STATES_CONFIG: PipelineState[] = [
  {
    key: 'nuevo',
    label: 'Nuevo',
    color: 'bg-gray-500',
    orden: 1,
    prerequisitos: [],
    descripcion: 'Candidato recien aplicado, sin revisar',
  },
  {
    key: 'en_revision',
    label: 'En revision',
    color: 'bg-blue-500',
    orden: 2,
    prerequisitos: ['nuevo'],
    descripcion: 'Candidato siendo revisado por el equipo',
  },
  {
    key: 'preseleccionado',
    label: 'Preseleccionado',
    color: 'bg-violet-500',
    orden: 3,
    prerequisitos: ['en_revision'],
    descripcion: 'Candidato pasa filtro inicial y es preseleccionado',
  },
  {
    key: 'entrevista_ia',
    label: 'Entrevista IA',
    color: 'bg-amber-500',
    orden: 4,
    prerequisitos: ['preseleccionado'],
    descripcion: 'Candidato en proceso de entrevista con IA',
  },
  {
    key: 'evaluado',
    label: 'Evaluado',
    color: 'bg-teal-500',
    orden: 5,
    prerequisitos: ['preseleccionado'],
    descripcion: 'Candidato evaluado tecnica y/o conductualmente',
  },
  {
    key: 'entrevista_humana',
    label: 'Entrevista humana',
    color: 'bg-pink-500',
    orden: 6,
    prerequisitos: ['preseleccionado'],
    descripcion: 'Candidato en entrevista con el equipo',
  },
  {
    key: 'seleccionado',
    label: 'Seleccionado',
    color: 'bg-emerald-500',
    orden: 7,
    prerequisitos: ['entrevista_humana'],
    descripcion: 'Candidato seleccionado para la posicion',
  },
  {
    key: 'documentos_pendientes',
    label: 'Documentos pendientes',
    color: 'bg-orange-500',
    orden: 8,
    prerequisitos: ['seleccionado'],
    descripcion: 'Esperando documentos del candidato',
    automatico: true,
  },
  {
    key: 'documentos_completos',
    label: 'Documentos completos',
    color: 'bg-lime-500',
    orden: 9,
    prerequisitos: ['documentos_pendientes'],
    descripcion: 'Todos los documentos fueron recibidos y verificados',
    automatico: true,
  },
  {
    key: 'contratado',
    label: 'Contratado',
    color: 'bg-green-600',
    orden: 10,
    prerequisitos: ['documentos_completos'],
    descripcion: 'Candidato contratado oficialmente',
  },
  {
    key: 'contrato_terminado',
    label: 'Contrato terminado',
    color: 'bg-slate-500',
    orden: 11,
    prerequisitos: ['contratado'],
    descripcion: 'La relacion laboral ha finalizado',
  },
  {
    key: 'descartado',
    label: 'Descartado',
    color: 'bg-red-500',
    orden: 99,
    prerequisitos: [],
    descripcion: 'Candidato descartado del proceso',
  },
];

/**
 * Map for quick lookup by key.
 */
export const PIPELINE_STATES_MAP = new Map(
  PIPELINE_STATES_CONFIG.map((s) => [s.key, s])
);

/**
 * Returns all possible transitions from the current state,
 * with permission info based on completed states.
 */
export function getTransicionesPermitidas(
  estadoActual: string,
  estadosCompletados: string[],
  options?: { allowAuto?: boolean }
): TransicionInfo[] {
  const completadosSet = new Set(estadosCompletados);
  // The current state counts as "completed" for prerequisite checks
  completadosSet.add(estadoActual);

  return PIPELINE_STATES_CONFIG.map((state) => {
    const completado = completadosSet.has(state.key);

    // Current state is not a valid transition target
    if (state.key === estadoActual) {
      return { state, permitida: false, razon: 'Estado actual', completado: true };
    }

    // Descartado: allowed from any state except contratado
    if (state.key === 'descartado') {
      if (estadoActual === 'contratado' || estadoActual === 'contrato_terminado') {
        return { state, permitida: false, razon: 'Usa "Terminar contrato" para finalizar la relacion laboral', completado };
      }
      return { state, permitida: true, completado };
    }

    // From contratado: only contrato_terminado is allowed
    if (estadoActual === 'contratado' && state.key !== 'contrato_terminado') {
      return { state, permitida: false, razon: 'Candidato ya contratado', completado };
    }

    // contrato_terminado is a final state — no transitions out
    if (estadoActual === 'contrato_terminado') {
      return { state, permitida: false, razon: 'Estado final — contrato terminado', completado };
    }

    // Automatic states cannot be set manually (unless forced by system)
    if (state.automatico && !options?.allowAuto) {
      return { state, permitida: false, razon: 'Este estado se asigna automaticamente', completado };
    }

    // Check prerequisites
    const prerequisitosFaltantes = state.prerequisitos.filter(
      (p) => !completadosSet.has(p)
    );

    if (prerequisitosFaltantes.length > 0) {
      const faltantes = prerequisitosFaltantes
        .map((p) => PIPELINE_STATES_MAP.get(p)?.label || p)
        .join(', ');
      return {
        state,
        permitida: false,
        razon: `Requiere completar: ${faltantes}`,
        completado,
      };
    }

    return { state, permitida: true, completado };
  });
}
