import type { SearchEvent } from '../../domain/search';

export type SearchParameters = [string, string][];

export interface SearchGateway {
  search(parameters: SearchParameters): Promise<SearchEvent[]>;
  getLocationEvents(): Promise<SearchEvent[]>;
}
