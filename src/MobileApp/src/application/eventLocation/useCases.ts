import type { EventLocationGateway } from './ports';

export function createGeocodeLocation(gateway: EventLocationGateway) {
  return (location: string) => gateway.geocodeLocation(location);
}
