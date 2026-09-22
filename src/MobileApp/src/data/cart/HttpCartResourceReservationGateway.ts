import { API_URL, apiCall } from '../../../config';
import type { CartResourceReservationGateway } from '../../application/cart/ports';

export const httpCartResourceReservationGateway: CartResourceReservationGateway = {
  async reserveResource({ resourceId, quantity, userTicketId, token }) {
    await apiCall(`${API_URL}/api/Resource/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        EventResourceID: resourceId,
        Quantity: quantity,
        UserTicketID: userTicketId,
      }),
    });
  },
};
