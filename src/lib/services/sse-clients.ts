/**
 * Registro en memoria de clientes SSE conectados por organizacion.
 * Modulo separado para evitar exportar funciones no-handler desde route files.
 */
const clients = new Map<string, Set<(data: string) => void>>();

export function getClients(): Map<string, Set<(data: string) => void>> {
  return clients;
}

/**
 * Envia un evento SSE a todos los clientes de una organizacion.
 */
export function emitirNotificacion(organizacionId: string, payload: object): void {
  const orgClients = clients.get(organizacionId);
  if (!orgClients || orgClients.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  orgClients.forEach(send => {
    try { send(data); } catch { /* cliente desconectado */ }
  });
}
