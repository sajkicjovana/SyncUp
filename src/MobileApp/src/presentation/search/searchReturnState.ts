import type { SearchEvent, SearchPrices } from '../../domain/search';

export type SearchReturnSnapshot = {
  searchQuery: string;
  selectedLocation: string | null;
  selectedCategory: string | null;
  startDate: Date | null;
  endDate: Date | null;
  isFree: boolean;
  sortBy: string;
  events: SearchEvent[];
  eventPrices: SearchPrices;
  locations: Array<{ label: string; value: string }>;
};

type PendingSearchReturn = {
  key: string;
  snapshot: SearchReturnSnapshot;
};

let nextKey = 1;
let pendingSearchReturn: PendingSearchReturn | null = null;

export function captureSearchReturnState(snapshot: SearchReturnSnapshot): string {
  const key = `search-${nextKey++}`;
  pendingSearchReturn = { key, snapshot };
  return key;
}

export function consumeSearchReturnState(key: unknown): SearchReturnSnapshot | null {
  if (typeof key !== 'string' || pendingSearchReturn?.key !== key) return null;

  const { snapshot } = pendingSearchReturn;
  pendingSearchReturn = null;
  return snapshot;
}

export function clearSearchReturnState(): void {
  pendingSearchReturn = null;
}
