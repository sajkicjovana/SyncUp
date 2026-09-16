import type { SearchEvent, SearchPrice } from '../../domain/search';

export type SearchParameters = [string, string][];

export interface SearchGateway {
  search(parameters: SearchParameters): Promise<SearchEvent[]>;
  getLocationEvents(): Promise<SearchEvent[]>;
  getEventPrice(eventId: number): Promise<SearchPrice>;
}
