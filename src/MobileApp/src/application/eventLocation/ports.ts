import type { EventLocation } from '../../domain/eventLocation';

export interface EventLocationGateway {
  geocodeLocation(location: string): Promise<EventLocation | null>;
}
