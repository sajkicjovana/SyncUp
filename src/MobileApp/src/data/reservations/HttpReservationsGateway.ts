import { API_URL, apiCall } from '../../../config';
import type { ReservationRow, ReservationsGateway } from '../../application/reservations/ports';

type ReservationDto = {
  eventID: number;
  eventTitle: string;
  eventDate: string;
  eventEndDate: string;
  eventLocation: string;
  isEventFree: boolean;
  resourceName: string;
  quantity: number;
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
        EventID: r.eventID,
        EventTitle: r.eventTitle,
        EventDate: r.eventDate,
        EventEndDate: r.eventEndDate,
        EventLocation: r.eventLocation,
        IsEventFree: r.isEventFree,
        ResourceName: r.resourceName,
        Quantity: r.quantity,
      });
    });
    return { ok: true, rows };
  },
};
