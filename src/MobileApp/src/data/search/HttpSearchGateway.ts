import { API_URL, apiCall } from '../../../config';
import type { SearchCriteria } from '../../domain/search';
import type { SearchGateway } from '../../application/search/ports';

function buildSearchQuery(criteria: SearchCriteria): URLSearchParams {
  const { searchQuery, selectedLocation, startDate, endDate, sortBy, selectedCategory } = criteria;
  const params = new URLSearchParams();
  if (searchQuery) params.append('name', searchQuery);
  if (selectedLocation) params.append('location', selectedLocation);
  if (startDate) params.append('startDate', startDate.toISOString());
  if (endDate) params.append('endDate', endDate.toISOString());
  switch (sortBy) {
    case 'popularity':
      params.append('sortBy', 'popularity');
      params.append('sortOrder', 'desc');
      break;
    case 'priceAsc':
      params.append('sortBy', 'price');
      params.append('sortOrder', 'asc');
      break;
    case 'priceDesc':
      params.append('sortBy', 'price');
      params.append('sortOrder', 'desc');
      break;
    case 'dateAsc':
      params.append('sortBy', 'startDate');
      params.append('sortOrder', 'asc');
      break;
    case 'dateDesc':
      params.append('sortBy', 'startDate');
      params.append('sortOrder', 'desc');
      break;
  }
  if (selectedCategory) params.append('category', selectedCategory);
  return params;
}

export const httpSearchGateway: SearchGateway = {
  search(criteria) {
    const params = buildSearchQuery(criteria);
    return apiCall(`${API_URL}/api/Events/search?${params.toString()}`)
      .then((response) => response.json());
  },
  async getLocationEvents() {
    const response = await apiCall(`${API_URL}/api/Events`);
    return response.json();
  },
  async getEventPrice(eventId) {
    const response = await apiCall(`${API_URL}/api/Events/Details?id=${eventId}`);
    return response.json();
  },
};
