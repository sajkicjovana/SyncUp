import type { EventAgendaGateway } from './ports';

export function createLoadEventAgenda(gateway: EventAgendaGateway) {
  return (eventId: number | string, token?: string | null) => gateway.loadAgenda(eventId, token);
}
