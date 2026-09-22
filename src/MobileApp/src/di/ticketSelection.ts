import { createLoadTicketSelectionOptions } from '../application/ticketSelection/useCases';
import { asyncStorageSessionStore } from '../data/auth/AsyncStorageSessionStore';
import { httpTicketSelectionGateway } from '../data/ticketSelection/HttpTicketSelectionGateway';

export const loadTicketSelectionOptions = createLoadTicketSelectionOptions(
  httpTicketSelectionGateway,
  asyncStorageSessionStore.getToken,
);
