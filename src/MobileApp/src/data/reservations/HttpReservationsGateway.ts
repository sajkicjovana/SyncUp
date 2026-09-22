import { API_URL, apiCall } from '../../../config';
import type { ReservationRow, ReservationsGateway } from '../../application/reservations/ports';

type ReservationDto = {
  reservationID: number;
  eventResourceID: number;
  eventID: number;
  eventTitle: string;
  eventDate: string;
  eventEndDate: string;
  eventLocation: string;
  isEventFree: boolean;
  resourceName: string;
  resourceCategory: string;
  resourceDescription: string;
  quantity: number;
  reservedAt: string;
  userTickets: Array<{
    userTicketID: number;
    ticketType: string | null | undefined;
  }> | null | undefined;
};

export const httpReservationsGateway: ReservationsGateway = {
  async loadMyReservations(token) {
    const response = await apiCall(`${API_URL}/api/Resource/my-reservations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { ok: false };

    const data = await response.json();
    const rows: ReservationRow[] = [];
    data.forEach((r: ReservationDto) => {
      rows.push({
        ReservationID: r.reservationID,
        EventResourceID: r.eventResourceID,
        EventID: r.eventID,
        EventTitle: r.eventTitle,
        EventDate: r.eventDate,
        EventEndDate: r.eventEndDate,
        EventLocation: r.eventLocation,
        IsEventFree: r.isEventFree,
        ResourceName: r.resourceName,
        ResourceCategory: r.resourceCategory,
        ResourceDescription: r.resourceDescription,
        Quantity: r.quantity,
        ReservedAt: r.reservedAt,
        UserTickets: r.userTickets == null
          ? r.userTickets
          : r.userTickets.map((ticket) => ({
            UserTicketID: ticket.userTicketID,
            ticketType: ticket.ticketType,
          })),
      });
    });
    return { ok: true, rows };
  },
};
