import { API_URL, apiCall } from '../../../config';
import type { SearchGateway } from '../../application/search/ports';

export const httpSearchGateway: SearchGateway = {
  async search(parameters) {
    const params = new URLSearchParams();
    for (const [name, value] of parameters) params.append(name, value);
    const response = await apiCall(`${API_URL}/api/Events/search?${params.toString()}`);
    return response.json();
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
