import { createGeocodeLocation } from '../application/eventLocation/useCases';
import { httpEventLocationGateway } from '../data/eventLocation/HttpEventLocationGateway';

export const geocodeLocation = createGeocodeLocation(httpEventLocationGateway);
