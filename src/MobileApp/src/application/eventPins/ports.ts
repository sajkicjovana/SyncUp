import type { EventPin, PinCategory } from '../../domain/eventPins';

export interface EventPinsGateway {
  loadEventPins(eventId: number, token?: string | null): Promise<EventPin[]>;
  loadPinCategories(): Promise<PinCategory[]>;
}
