export type ReservationRow = {
  EventID: number;
  EventTitle: string;
  EventDate: string;
  EventEndDate: string;
  EventLocation: string;
  IsEventFree: boolean;
  ResourceName: string;
  Quantity: number;
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

export type ReservationsGatewayResult =
  | { ok: true; rows: ReservationRow[] }
  | { ok: false };

export interface ReservationsGateway {
  loadMyReservations(token: string): Promise<ReservationsGatewayResult>;
}

export type ReadToken = () => Promise<string | null>;
