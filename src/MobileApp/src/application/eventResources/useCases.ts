import type { EventResourcesGateway } from './ports';

export function createLoadEventResources(gateway: EventResourcesGateway) {
  return (eventId: string, token: string) => gateway.loadEventResources(eventId, token);
}
