import { selectBrowsableEvents } from '../../domain/eventList';
import type { EventListItem } from '../../domain/eventList';
import type { EventListGateway } from './ports';

export type LoadEventsResult =
  | { status: 'loaded'; events: EventListItem[] }
  | { status: 'request-failed'; statusCode: number }
  | { status: 'failure'; error: unknown };

export function createLoadEvents(gateway: EventListGateway, now: () => Date) {
  return async (): Promise<LoadEventsResult> => {
    try {
      const result = await gateway.getEvents();
      if (!result.ok) return { status: 'request-failed', statusCode: result.statusCode };
      return { status: 'loaded', events: selectBrowsableEvents(result.events, now()) };
    } catch (error) {
      return { status: 'failure', error };
    }
  };
}
