import { uniqueSearchLocations } from '../../domain/search';
import type { SearchCriteria } from '../../domain/search';
import type { SearchGateway, SearchParameters } from './ports';

export function prepareSearchParameters(criteria: SearchCriteria): SearchParameters {
  const { searchQuery, selectedLocation, startDate, endDate, sortBy, selectedCategory } = criteria;
  const params: SearchParameters = [];
  if (searchQuery) params.push(['name', searchQuery]);
  if (selectedLocation) params.push(['location', selectedLocation]);
  if (startDate) params.push(['startDate', startDate.toISOString()]);
  if (endDate) params.push(['endDate', endDate.toISOString()]);
  switch (sortBy) {
    case 'popularity':
      params.push(['sortBy', 'popularity'], ['sortOrder', 'desc']);
      break;
    case 'priceAsc':
      params.push(['sortBy', 'price'], ['sortOrder', 'asc']);
      break;
    case 'priceDesc':
      params.push(['sortBy', 'price'], ['sortOrder', 'desc']);
      break;
    case 'dateAsc':
      params.push(['sortBy', 'startDate'], ['sortOrder', 'asc']);
      break;
    case 'dateDesc':
      params.push(['sortBy', 'startDate'], ['sortOrder', 'desc']);
      break;
  }
  if (selectedCategory) params.push(['category', selectedCategory]);
  return params;
}

export function createSearchUseCases(gateway: SearchGateway) {
  return {
    loadSearchEvents: (criteria: SearchCriteria) => gateway.search(prepareSearchParameters(criteria)),
    loadLocations: async () => uniqueSearchLocations(await gateway.getLocationEvents()),
  };
}
