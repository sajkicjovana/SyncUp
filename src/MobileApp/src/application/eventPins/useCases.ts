import type { EventPinsGateway } from './ports';

export function createEventPinsUseCases(gateway: EventPinsGateway) {
  return {
    loadEventPins: (eventId: number, token?: string | null) => gateway.loadEventPins(eventId, token),
    loadPinCategories: () => gateway.loadPinCategories(),
  };
}
