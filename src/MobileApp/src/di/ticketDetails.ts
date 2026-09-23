import { createBuildTicketValidationUrl } from '../application/ticketDetails/useCases';
import { ticketValidationUrlBuilder } from '../data/ticketDetails/TicketValidationUrlBuilder';

export const buildTicketValidationUrl = createBuildTicketValidationUrl(
  ticketValidationUrlBuilder,
);
