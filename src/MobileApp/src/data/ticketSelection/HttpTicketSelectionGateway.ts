import { API_URL, apiCall } from '../../../config';
import type { TicketSelectionGateway } from '../../application/ticketSelection/ports';

export const httpTicketSelectionGateway: TicketSelectionGateway = {
  async loadOptions(eventId, token) {
    const [ticketsRes, resourcesRes] = await Promise.all([
      apiCall(`${API_URL}/api/Ticket/events/${eventId}/tickets`),
      apiCall(`${API_URL}/api/Resource/${eventId}/resources`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const ticketData = ticketsRes.ok ? await ticketsRes.json() : [];
    const rawResources = resourcesRes.ok ? await resourcesRes.json() : [];

    const tickets = ticketData.map((t: any, index: number) => ({
      id: t.ticketID ?? index,
      name: t.typeName,
      price: t.price,
      available: t.available,
    }));

    const resources = rawResources.map((r: any, index: number) => ({
      id: r.id ?? index,
      name: r.name,
      price: r.price ?? undefined,
      quantity: r.quantity,
      measure: r.measure,
    }));

    return { tickets, resources };
  },
};
