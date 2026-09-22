import type { CartDisplayGateway, CartResourceReservationGateway } from './ports';

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
