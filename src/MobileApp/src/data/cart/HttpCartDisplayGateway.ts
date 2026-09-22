import { API_URL, apiCall } from '../../../config';
import type { CartDisplayGateway } from '../../application/cart/ports';

export const httpCartDisplayGateway: CartDisplayGateway = {
  async loadDisplayData(eventId, token) {
    const ticketRes = await apiCall(`${API_URL}/api/Ticket/events/${eventId}/tickets`);
    const ticketsJson = ticketRes.ok ? await ticketRes.json() : [];

    const resourceRes = await apiCall(`${API_URL}/api/Resource/${eventId}/resources`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const resourcesJson = resourceRes.ok ? await resourceRes.json() : [];

    const tickets = ticketsJson.map((t: any) => ({ id: t.ticketID, name: t.typeName, price: t.price }));
    const resources = resourcesJson.map((r: any) => ({ id: r.id, name: r.name, price: r.price }));

    return { tickets, resources };
  },
};
