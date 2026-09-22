import type { ReadToken, TicketSelectionGateway } from './ports';

export function createLoadTicketSelectionOptions(gateway: TicketSelectionGateway, readToken: ReadToken) {
  return async (eventId: string) => {
    const token = await readToken();
    return gateway.loadOptions(eventId, token);
  };
}
