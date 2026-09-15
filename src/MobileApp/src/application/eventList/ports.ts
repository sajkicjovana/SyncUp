import type { EventListItem } from '../../domain/eventList';

export type EventListResponse =
  | { ok: true; events: EventListItem[] }
  | { ok: false; statusCode: number };

export interface EventListGateway {
  getEvents(): Promise<EventListResponse>;
}
