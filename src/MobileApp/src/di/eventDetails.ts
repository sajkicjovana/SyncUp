import { createLoadEventDetails } from '../application/eventDetails/useCases';
import { httpEventDetailsGateway } from '../data/eventDetails/HttpEventDetailsGateway';

export const loadEventDetails = createLoadEventDetails(httpEventDetailsGateway);
