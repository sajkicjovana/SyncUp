import { createEventPinsUseCases } from '../application/eventPins/useCases';
import { httpEventPinsGateway } from '../data/eventPins/HttpEventPinsGateway';

export const eventPinsUseCases = createEventPinsUseCases(httpEventPinsGateway);
