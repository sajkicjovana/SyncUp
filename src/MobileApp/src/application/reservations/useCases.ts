import type {
  EventReservationSummary,
  ReadToken,
  ReservationDetailsProjection,
  ReservationDetailsResource,
  ReservationsGateway,
  ReservationRow,
} from './ports';

export type LoadMyReservationsResult =
  | { status: 'missing-token' }
  | { status: 'non-ok' }
  | { status: 'loaded'; reservations: EventReservationSummary[] };

export type LoadReservationDetailsResult =
  | { status: 'missing-token' }
  | { status: 'non-ok' }
  | { status: 'loaded'; details: ReservationDetailsProjection | null };

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

function projectReservationDetails(
  rows: ReservationRow[],
  eventId: string | undefined,
): ReservationDetailsProjection | null {
  const routeEventId: unknown = eventId;
  const eventReservations = rows.filter((row) => row.EventID == routeEventId);
  if (eventReservations.length === 0) return null;

  const stableGroups = new Map<number | string, ReservationDetailsResource>();
  const fallbackGroups = new Map<string, ReservationDetailsResource>();
  const groupedResources: ReservationDetailsResource[] = [];
  eventReservations.forEach((row) => {
    const stableId = row.EventResourceID as number | string | null | undefined;
    const group = stableId == null
      ? fallbackGroups.get(row.ResourceName)
      : stableGroups.get(stableId);

    if (!group) {
      const newGroup: ReservationDetailsResource = {
        ReservationID: row.ReservationID,
        ResourceName: row.ResourceName,
        ResourceCategory: row.ResourceCategory,
        ResourceDescription: row.ResourceDescription,
        Quantity: row.Quantity,
        ReservedAt: row.ReservedAt,
        EventTitle: row.EventTitle,
        EventID: row.EventID,
        EventDate: row.EventDate,
        EventEndDate: row.EventEndDate,
        UserTickets: row.UserTickets ?? [],
      };

      if (stableId == null) {
        fallbackGroups.set(row.ResourceName, newGroup);
      } else {
        stableGroups.set(stableId, newGroup);
      }
      groupedResources.push(newGroup);
    } else {
      group.Quantity += row.Quantity;
      if (new Date(row.ReservedAt) > new Date(group.ReservedAt)) {
        group.ReservedAt = row.ReservedAt;
      }
    }
  });

  return {
    EventTitle: eventReservations[0].EventTitle,
    Resources: groupedResources,
  };
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

export function createLoadReservationDetails(gateway: ReservationsGateway, readToken: ReadToken) {
  return async (eventId: string | undefined): Promise<LoadReservationDetailsResult> => {
    const token = await readToken();
    if (!token) return { status: 'missing-token' };

    const result = await gateway.loadMyReservations(token);
    if (!result.ok) return { status: 'non-ok' };

    return { status: 'loaded', details: projectReservationDetails(result.rows, eventId) };
  };
}
