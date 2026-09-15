export type SearchEvent = {
  id: number;
  title: string;
  startDate: string;
  location: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  imageUrl: string;
};

export type SearchPrice = {
  minPrice?: number | null;
  maxPrice?: number | null;
};

export type SearchPrices = Record<number, SearchPrice>;

export type SearchCriteria = {
  searchQuery: string;
  selectedLocation: string | null;
  startDate: Date | null;
  endDate: Date | null;
  sortBy: string;
  selectedCategory: string | null;
};

export function selectFreeSearchEvents(events: SearchEvent[], prices: SearchPrices): SearchEvent[] {
  return events.filter((event) => {
    const price = prices[event.id];
    return price && (!price.minPrice && !price.maxPrice || price.minPrice === 0 && price.maxPrice === 0);
  });
}

export function uniqueSearchLocations(events: SearchEvent[]): string[] {
  return Array.from(new Set(events.map(event => event.location))).filter(Boolean);
}
