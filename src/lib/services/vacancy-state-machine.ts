/**
 * Pure state machine for vacancy status transitions.
 * No DB or server imports — safe for client-side import.
 */

export type VacancyEstado = 'borrador' | 'publicada' | 'pausada' | 'cerrada' | 'archivada';
export type LinkedInAction = 'publish' | 'close' | 'none';

export interface StateTransition {
  from: VacancyEstado;
  to: VacancyEstado;
  label: string;
  linkedinAction: LinkedInAction;
  requiresConfirmation: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
  destructive?: boolean;
}

const TRANSITIONS: StateTransition[] = [
  {
    from: 'borrador',
    to: 'publicada',
    label: 'Publicar',
    linkedinAction: 'publish',
    requiresConfirmation: true,
    confirmTitle: 'Publicar vacante',
    confirmMessage: 'La vacante sera visible para candidatos y se publicara en LinkedIn si esta configurado.',
  },
  {
    from: 'publicada',
    to: 'pausada',
    label: 'Pausar',
    linkedinAction: 'close',
    requiresConfirmation: true,
    confirmTitle: 'Pausar vacante',
    confirmMessage: 'La vacante dejara de recibir candidatos. Si esta publicada en LinkedIn, se cerrara la publicacion. Al reactivar se creara una nueva publicacion.',
  },
  {
    from: 'publicada',
    to: 'cerrada',
    label: 'Cerrar',
    linkedinAction: 'close',
    requiresConfirmation: true,
    confirmTitle: 'Cerrar vacante',
    confirmMessage: 'La vacante se cerrara definitivamente. Si esta publicada en LinkedIn, se cerrara la publicacion.',
    destructive: true,
  },
  {
    from: 'pausada',
    to: 'publicada',
    label: 'Reactivar',
    linkedinAction: 'publish',
    requiresConfirmation: true,
    confirmTitle: 'Reactivar vacante',
    confirmMessage: 'La vacante volvera a estar activa y se creara una nueva publicacion en LinkedIn si esta configurado.',
  },
  {
    from: 'pausada',
    to: 'cerrada',
    label: 'Cerrar',
    linkedinAction: 'none',
    requiresConfirmation: true,
    confirmTitle: 'Cerrar vacante',
    confirmMessage: 'La vacante se cerrara definitivamente.',
    destructive: true,
  },
  {
    from: 'cerrada',
    to: 'archivada',
    label: 'Archivar',
    linkedinAction: 'none',
    requiresConfirmation: false,
  },
];

export function getValidTransitions(currentEstado: VacancyEstado): StateTransition[] {
  return TRANSITIONS.filter((t) => t.from === currentEstado);
}

export function isValidTransition(from: VacancyEstado, to: VacancyEstado): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to);
}

export function getTransition(from: VacancyEstado, to: VacancyEstado): StateTransition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function isTerminalState(estado: VacancyEstado): boolean {
  return estado === 'archivada';
}
