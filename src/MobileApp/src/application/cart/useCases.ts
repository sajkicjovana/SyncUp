import type {
  CartDisplayGateway,
  CartResourceReservationGateway,
  CartTicketPurchaseGateway,
  InferredCartTicket,
  StandardCartPurchaseInput,
} from './ports';

export function createLoadCartDisplayData(gateway: CartDisplayGateway) {
  return (eventId: string | string[], token: string | null) => gateway.loadDisplayData(eventId, token);
}

export function createReserveResourcesWithoutTicket(gateway: CartResourceReservationGateway) {
  return async (resourceIds: number[], token: string) => {
    for (const resourceId of resourceIds) {
      await gateway.reserveResource({ resourceId, quantity: 1, userTicketId: null, token });
    }
  };
}

export type CartStandardPurchaseStage = 'beforeTickets' | 'purchase' | 'afterTickets';

export class CartStandardPurchaseError extends Error {
  constructor(
    readonly stage: CartStandardPurchaseStage,
    readonly responseText?: string,
  ) {
    super(stage);
    this.name = 'CartStandardPurchaseError';
  }
}

export function createPurchaseStandardCart(
  ticketGateway: CartTicketPurchaseGateway,
  resourceGateway: CartResourceReservationGateway,
) {
  return async ({ eventId, selectedTickets, selectedResourceIds, token }: StandardCartPurchaseInput): Promise<InferredCartTicket[]> => {
    const before = await ticketGateway.loadMyTickets(token);
    if (before.kind === 'rejected') throw new CartStandardPurchaseError('beforeTickets');
    const existingTicketIds = new Set(before.tickets.map(ticket => ticket.userTicketId));

    if (selectedTickets.length > 0) {
      const selections = selectedTickets.map(ticket => ({ ticketId: ticket.id, quantity: ticket.quantity }));
      const purchase = await ticketGateway.purchaseTickets(selections, token);
      if (purchase.kind === 'rejected') throw new CartStandardPurchaseError('purchase', purchase.responseText);
    }

    const after = await ticketGateway.loadMyTickets(token);
    if (after.kind === 'rejected') throw new CartStandardPurchaseError('afterTickets');
    const newlyPurchasedTickets = after.tickets.filter(ticket =>
      ticket.eventId === eventId && !existingTicketIds.has(ticket.userTicketId)
    );

    for (const resourceId of selectedResourceIds) {
      await resourceGateway.reserveResource({
        resourceId,
        quantity: 1,
        userTicketId: newlyPurchasedTickets.length > 0 ? newlyPurchasedTickets[0].userTicketId : null,
        token,
      });
    }

    return newlyPurchasedTickets.map(ticket => ({
      userTicketId: ticket.userTicketId,
      validationToken: ticket.validationToken,
    }));
  };
}
