import type { CartDisplayGateway } from './ports';

export function createLoadCartDisplayData(gateway: CartDisplayGateway) {
  return (eventId: string | string[], token: string | null) => gateway.loadDisplayData(eventId, token);
}
