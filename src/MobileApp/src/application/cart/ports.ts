export type CartTicketDisplayItem = { id: number; name: string; price: number };
export type CartResourceDisplayItem = { id: number; name: string; price?: number };

export type CartDisplayData = {
  tickets: CartTicketDisplayItem[];
  resources: CartResourceDisplayItem[];
};

export interface CartDisplayGateway {
  loadDisplayData(eventId: string | string[], token: string | null): Promise<CartDisplayData>;
}

export type ResourceReservationInput = {
  resourceId: number;
  quantity: number;
  userTicketId: number | string | null | undefined;
  token: string;
};

export interface CartResourceReservationGateway {
  reserveResource(input: ResourceReservationInput): Promise<void>;
}

export type CartTicketSelection = { ticketId: number; quantity: number };

export type CartOwnedTicket = {
  userTicketId: number | string | undefined;
  eventId: number | string | undefined;
  validationToken: string | undefined;
};

export type CartTicketLoadResult =
  | { kind: 'loaded'; tickets: CartOwnedTicket[] }
  | { kind: 'rejected' };

export type CartTicketPurchaseResult =
  | { kind: 'accepted' }
  | { kind: 'rejected'; responseText: string };

export interface CartTicketPurchaseGateway {
  loadMyTickets(token: string): Promise<CartTicketLoadResult>;
  purchaseTickets(selections: CartTicketSelection[], token: string): Promise<CartTicketPurchaseResult>;
}

export type StandardCartPurchaseInput = {
  eventId: number;
  selectedTickets: { id: number; quantity: number }[];
  selectedResourceIds: number[];
  token: string;
};

export type InferredCartTicket = Pick<CartOwnedTicket, 'userTicketId' | 'validationToken'>;
