import type { SearchCriteria, SearchEvent, SearchPrice } from '../../domain/search';

export interface SearchGateway {
  search(criteria: SearchCriteria): Promise<SearchEvent[]>;
  getLocationEvents(): Promise<SearchEvent[]>;
  getEventPrice(eventId: number): Promise<SearchPrice>;
}
