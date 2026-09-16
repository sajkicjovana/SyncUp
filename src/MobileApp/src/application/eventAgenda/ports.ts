import type { EventAgendaResponse } from '../../domain/eventAgenda';

export interface EventAgendaGateway {
  loadAgenda(eventId: number | string, token?: string | null): Promise<EventAgendaResponse>;
}
