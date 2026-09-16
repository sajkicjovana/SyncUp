import type { EventDetailsGateway } from './ports';

export function createLoadEventDetails(gateway: EventDetailsGateway) {
  return (eventId: string, token?: string | null) => gateway.loadEventDetails(eventId, token);
}
