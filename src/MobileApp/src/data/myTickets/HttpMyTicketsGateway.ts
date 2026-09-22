import { API_URL, apiCall } from '../../../config';
import type { MyTicketsGateway } from '../../application/myTickets/ports';

export const httpMyTicketsGateway: MyTicketsGateway = {
  async loadMyTickets(token) {
    const response = await apiCall(`${API_URL}/api/ticket/tickets/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return { ok: false };

    const tickets = await response.json();
    return {
      ok: true,
      tickets: tickets.map((ticket: any) => ({
        purchasedAt: ticket.purchasedAt,
        ticketType: ticket.ticketType,
        eventName: ticket.eventName,
        price: ticket.price,
        eventId: ticket.eventID,
        ticketDefinitionId: ticket.ticketID,
        userTicketId: ticket.userTicketID,
        validationToken: ticket.validationToken,
      })),
    };
  },
};
