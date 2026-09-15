import { API_URL, apiCall } from '../../../config';
import type { EventListGateway } from '../../application/eventList/ports';

export const httpEventListGateway: EventListGateway = {
  async getEvents() {
    const response = await apiCall(`${API_URL}/api/events`);
    if (!response.ok) return { ok: false, statusCode: response.status };
    return { ok: true, events: await response.json() };
  },
};
