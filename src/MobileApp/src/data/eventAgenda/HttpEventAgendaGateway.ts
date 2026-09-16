import { API_URL, apiCall } from '../../../config';
import type { EventAgendaGateway } from '../../application/eventAgenda/ports';

export const httpEventAgendaGateway: EventAgendaGateway = {
  async loadAgenda(eventId, token) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await apiCall(`${API_URL}/api/events/subevents-activities/${eventId}`, { headers });
    if (!response.ok) throw new Error('Failed to load agenda');
    return response.json();
  },
};
