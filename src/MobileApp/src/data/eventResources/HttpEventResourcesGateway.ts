import { API_URL, apiCall } from '../../../config';
import type { EventResourcesGateway } from '../../application/eventResources/ports';

export const httpEventResourcesGateway: EventResourcesGateway = {
  async loadEventResources(eventId, token) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    const response = await apiCall(`${API_URL}/api/Resource/${eventId}/resources`, { headers });
    if (!response.ok) throw new Error('Failed to load resources');
    return response.json();
  },
};
