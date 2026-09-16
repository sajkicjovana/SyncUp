import { API_URL, apiCall } from '../../../config';
import type { EventPinsGateway } from '../../application/eventPins/ports';

export const httpEventPinsGateway: EventPinsGateway = {
  async loadEventPins(eventId, token) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await apiCall(`${API_URL}/api/EventPin/event/?eventId=${eventId}`, { headers });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }
    return response.json();
  },

  async loadPinCategories() {
    const response = await apiCall(`${API_URL}/api/EventPin/categories`);
    if (!response.ok) throw new Error('Failed to load categories');
    return response.json();
  },
};
