export interface EventResourcesGateway {
  loadEventResources(eventId: string, token: string): Promise<unknown[]>;
}
