export interface TicketValidationUrlBuilder {
  build(ticketId: number, validationToken: string): string;
}
