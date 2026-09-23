import { API_URL } from '../../../config';
import type { TicketValidationUrlBuilder } from '../../application/ticketDetails/ports';

export const ticketValidationUrlBuilder: TicketValidationUrlBuilder = {
  build(ticketId, validationToken) {
    return `${API_URL}/api/TicketValidation/validate/${ticketId}/${validationToken}`;
  },
};
