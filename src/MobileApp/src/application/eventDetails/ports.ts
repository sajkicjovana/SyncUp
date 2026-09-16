import type { EventDetails } from '../../domain/eventDetails';

export interface EventDetailsGateway {
  loadEventDetails(eventId: string, token?: string | null): Promise<EventDetails>;
}
