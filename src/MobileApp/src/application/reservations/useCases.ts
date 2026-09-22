import type { EventReservationSummary, ReadToken, ReservationsGateway, ReservationRow } from './ports';

export type LoadMyReservationsResult =
  | { status: 'missing-token' }
  | { status: 'non-ok' }
  | { status: 'loaded'; reservations: EventReservationSummary[] };

function groupReservations(rows: ReservationRow[]): EventReservationSummary[] {
  const grouped: Record<number, EventReservationSummary> = {};
  rows.forEach((row) => {
    if (!grouped[row.EventID]) {
      grouped[row.EventID] = {
        EventID: row.EventID,
        EventTitle: row.EventTitle,
        EventDate: row.EventDate,
        EventEndDate: row.EventEndDate,
        EventLocation: row.EventLocation,
        IsEventFree: row.IsEventFree,
        Resources: [],
      };
    }
    grouped[row.EventID].Resources.push({ Name: row.ResourceName, Quantity: row.Quantity });
  });
  return Object.values(grouped);
}

export function createLoadMyReservations(gateway: ReservationsGateway, readToken: ReadToken) {
  return async (): Promise<LoadMyReservationsResult> => {
    const token = await readToken();
    if (!token) return { status: 'missing-token' };

    const result = await gateway.loadMyReservations(token);
    if (!result.ok) return { status: 'non-ok' };

    return { status: 'loaded', reservations: groupReservations(result.rows) };
  };
}
