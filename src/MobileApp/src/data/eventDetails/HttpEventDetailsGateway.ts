import { API_URL, apiCall } from '../../../config';
import type { EventDetailsGateway } from '../../application/eventDetails/ports';

export const httpEventDetailsGateway: EventDetailsGateway = {
  async loadEventDetails(eventId, token) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await apiCall(`${API_URL}/api/Events/Details?id=${eventId}`, { headers });
    if (!response.ok) throw new Error('Event details request failed');
    return response.json();
  },
};
