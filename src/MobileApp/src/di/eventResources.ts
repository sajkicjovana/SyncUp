import { createLoadEventResources } from '../application/eventResources/useCases';
import { httpEventResourcesGateway } from '../data/eventResources/HttpEventResourcesGateway';

export const loadEventResources = createLoadEventResources(httpEventResourcesGateway);
