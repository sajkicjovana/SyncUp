import { createSearchUseCases } from '../application/search/useCases';
import { httpSearchGateway } from '../data/search/HttpSearchGateway';

export const searchUseCases = createSearchUseCases(httpSearchGateway);
