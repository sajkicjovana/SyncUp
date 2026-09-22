import { createLoadMyTickets } from '../application/myTickets/useCases';
import { asyncStorageSessionStore } from '../data/auth/AsyncStorageSessionStore';
import { httpMyTicketsGateway } from '../data/myTickets/HttpMyTicketsGateway';

export const loadMyTickets = createLoadMyTickets(
  httpMyTicketsGateway,
  asyncStorageSessionStore.getToken,
);
