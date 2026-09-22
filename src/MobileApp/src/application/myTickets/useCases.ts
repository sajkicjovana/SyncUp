import type {
  GroupedMyTicket,
  LoadMyTicketsResult,
  MyTicketRow,
  MyTicketsGateway,
  ReadToken,
} from './ports';

export class MyTicketsTokenReadError extends Error {
  readonly originalError: unknown;

  constructor(error: unknown) {
    super(error instanceof Error ? error.message : String(error));
    this.name = 'MyTicketsTokenReadError';
    this.originalError = error;
  }
}

function groupTickets(tickets: MyTicketRow[]): GroupedMyTicket[] {
  const grouped: Record<string, Omit<GroupedMyTicket, 'validationTokens'>> = {};

  tickets.forEach((ticket) => {
    const key = `${ticket.eventName}_${ticket.ticketType}`;
    if (!grouped[key]) {
      grouped[key] = {
        ticketType: ticket.ticketType,
        eventName: ticket.eventName,
        price: ticket.price,
        quantity: 1,
        eventId: ticket.eventId ?? 0,
        purchasedAt: [ticket.purchasedAt],
        ticketIds: [ticket.userTicketId],
      };
    } else {
      grouped[key].quantity += 1;
      grouped[key].ticketIds.push(ticket.userTicketId);
      grouped[key].purchasedAt.push(ticket.purchasedAt);
    }
  });

  const groupedTickets = Object.values(grouped);
  groupedTickets.sort(
    (a, b) => new Date(b.purchasedAt[b.purchasedAt.length - 1]).getTime()
      - new Date(a.purchasedAt[a.purchasedAt.length - 1]).getTime()
  );

  return groupedTickets.map((group) => ({
    ...group,
    validationTokens: group.ticketIds.map((id) => {
      const original = tickets.find(ticket => ticket.userTicketId === id);
      return original?.validationToken || '';
    }),
  }));
}

export function createLoadMyTickets(gateway: MyTicketsGateway, readToken: ReadToken) {
  return async (): Promise<LoadMyTicketsResult> => {
    let token: string | null;
    try {
      token = await readToken();
    } catch (error) {
      throw new MyTicketsTokenReadError(error);
    }

    if (!token) return { status: 'missing-token' };

    const result = await gateway.loadMyTickets(token);
    if (!result.ok) return { status: 'non-ok' };

    return { status: 'loaded', tickets: groupTickets(result.tickets) };
  };
}
