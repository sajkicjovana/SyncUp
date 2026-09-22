export type TicketOption = {
  id: number;
  name: string;
  price: number;
  available: number;
};

export type ResourceOption = {
  id: number;
  name: string;
  price?: number;
  quantity: number;
  measure: string;
};

export type TicketSelectionOptions = {
  tickets: TicketOption[];
  resources: ResourceOption[];
};

export interface TicketSelectionGateway {
  loadOptions(eventId: string, token: string | null): Promise<TicketSelectionOptions>;
}

export type ReadToken = () => Promise<string | null>;
