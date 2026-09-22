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
  type GroupWithoutTokens = Omit<GroupedMyTicket, 'validationTokens'>;
  const stableGroups = new Map<number | string, GroupWithoutTokens>();
  const fallbackGroups = new Map<string, GroupWithoutTokens>();
  const groupedTickets: GroupWithoutTokens[] = [];

  tickets.forEach((ticket) => {
    const ticketDefinitionId = ticket.ticketDefinitionId;
    let fallbackKey: string | undefined;
    let existingGroup: GroupWithoutTokens | undefined;

    if (ticketDefinitionId == null) {
      fallbackKey = `${ticket.eventName}_${ticket.ticketType}`;
      existingGroup = fallbackGroups.get(fallbackKey);
    } else {
      existingGroup = stableGroups.get(ticketDefinitionId);
    }

    if (!existingGroup) {
      const newGroup = {
        ticketType: ticket.ticketType,
        eventName: ticket.eventName,
        price: ticket.price,
        quantity: 1,
        eventId: ticket.eventId ?? 0,
        purchasedAt: [ticket.purchasedAt],
        ticketIds: [ticket.userTicketId],
      };

      if (ticketDefinitionId == null) {
        fallbackGroups.set(fallbackKey!, newGroup);
      } else {
        stableGroups.set(ticketDefinitionId, newGroup);
      }
      groupedTickets.push(newGroup);
    } else {
      existingGroup.quantity += 1;
      existingGroup.ticketIds.push(ticket.userTicketId);
      existingGroup.purchasedAt.push(ticket.purchasedAt);
    }
  });

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
