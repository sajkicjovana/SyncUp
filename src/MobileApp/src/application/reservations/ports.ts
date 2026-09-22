export type ReservationTicket = {
  UserTicketID: number;
  ticketType: string | null | undefined;
};

export type ReservationRow = {
  ReservationID: number;
  EventResourceID: number;
  EventID: number;
  EventTitle: string;
  EventDate: string;
  EventEndDate: string;
  EventLocation: string;
  IsEventFree: boolean;
  ResourceName: string;
  ResourceCategory: string;
  ResourceDescription: string;
  Quantity: number;
  ReservedAt: string;
  UserTickets: ReservationTicket[] | null | undefined;
};

export type EventReservationSummary = {
  EventID: number;
  EventTitle: string;
  EventDate: string;
  EventEndDate: string;
  EventLocation: string;
  IsEventFree: boolean;
  Resources: { Name: string; Quantity: number }[];
};

export type ReservationDetailsResource = {
  ReservationID: number;
  ResourceName: string;
  ResourceCategory: string;
  ResourceDescription: string;
  Quantity: number;
  ReservedAt: string;
  EventTitle: string;
  EventID: number;
  EventDate: string;
  EventEndDate: string;
  UserTickets: ReservationTicket[];
};

export type ReservationDetailsProjection = {
  EventTitle: string;
  Resources: ReservationDetailsResource[];
};

export type ReservationsGatewayResult =
  | { ok: true; rows: ReservationRow[] }
  | { ok: false };

export interface ReservationsGateway {
  loadMyReservations(token: string): Promise<ReservationsGatewayResult>;
}

export type ReadToken = () => Promise<string | null>;
