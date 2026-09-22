export type MyTicketRow = {
  purchasedAt: string;
  ticketType: string;
  eventName: string;
  price: number;
  eventId: number | null | undefined;
  userTicketId: number | string | undefined;
  validationToken: string | undefined;
};

export type GroupedMyTicket = {
  ticketType: string;
  eventName: string;
  price: number;
  quantity: number;
  eventId: number;
  purchasedAt: string[];
  ticketIds: Array<number | string | undefined>;
  validationTokens: string[];
};

export type MyTicketsGatewayResult =
  | { ok: true; tickets: MyTicketRow[] }
  | { ok: false };

export interface MyTicketsGateway {
  loadMyTickets(token: string): Promise<MyTicketsGatewayResult>;
}

export type ReadToken = () => Promise<string | null>;

export type LoadMyTicketsResult =
  | { status: 'missing-token' }
  | { status: 'non-ok' }
  | { status: 'loaded'; tickets: GroupedMyTicket[] };
