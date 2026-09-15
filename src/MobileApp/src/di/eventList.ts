import { createLoadEvents } from '../application/eventList/useCases';
import { httpEventListGateway } from '../data/eventList/HttpEventListGateway';

export const loadEvents = createLoadEvents(httpEventListGateway, () => new Date());
