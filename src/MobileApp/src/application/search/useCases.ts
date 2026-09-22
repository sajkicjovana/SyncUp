import { uniqueSearchLocations } from '../../domain/search';
import type { SearchCriteria } from '../../domain/search';
import type { SearchGateway } from './ports';

export function createSearchUseCases(gateway: SearchGateway) {
  return {
    loadSearchEvents: (criteria: SearchCriteria) => gateway.search(criteria),
    loadLocations: async () => uniqueSearchLocations(await gateway.getLocationEvents()),
    loadEventPrice: (eventId: number) => gateway.getEventPrice(eventId),
  };
}
