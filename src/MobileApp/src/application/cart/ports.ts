export type CartTicketDisplayItem = { id: number; name: string; price: number };
export type CartResourceDisplayItem = { id: number; name: string; price?: number };

export type CartDisplayData = {
  tickets: CartTicketDisplayItem[];
  resources: CartResourceDisplayItem[];
};

export interface CartDisplayGateway {
  loadDisplayData(eventId: string | string[], token: string | null): Promise<CartDisplayData>;
}
