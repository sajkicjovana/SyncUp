import { API_URL, apiCall } from '../../../config';
import type { CartTicketPurchaseGateway } from '../../application/cart/ports';

export const httpCartTicketPurchaseGateway: CartTicketPurchaseGateway = {
  async loadMyTickets(token) {
    const response = await apiCall(`${API_URL}/api/Ticket/tickets/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { kind: 'rejected' };

    const tickets = await response.json();
    return {
      kind: 'loaded',
      tickets: tickets.map((ticket: any) => ({
        userTicketId: ticket.userTicketID,
        eventId: ticket.eventID,
        validationToken: ticket.validationToken,
      })),
    };
  },

  async purchaseTickets(selections, token) {
    const response = await apiCall(`${API_URL}/api/Ticket/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(selections.map(selection => ({
        TicketID: selection.ticketId,
        Quantity: selection.quantity,
      }))),
    });
    if (!response.ok) return { kind: 'rejected', responseText: await response.text() };
    return { kind: 'accepted' };
  },
};
