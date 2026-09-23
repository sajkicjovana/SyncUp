import type { TicketValidationUrlBuilder } from './ports';

export function createBuildTicketValidationUrl(builder: TicketValidationUrlBuilder) {
  return (ticketId: number, validationToken: string): string =>
    builder.build(ticketId, validationToken);
}
