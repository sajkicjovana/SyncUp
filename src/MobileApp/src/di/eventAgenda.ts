import { createLoadEventAgenda } from '../application/eventAgenda/useCases';
import { httpEventAgendaGateway } from '../data/eventAgenda/HttpEventAgendaGateway';

export const loadEventAgenda = createLoadEventAgenda(httpEventAgendaGateway);
