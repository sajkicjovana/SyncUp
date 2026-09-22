import { createLoadProfileDashboard } from '../application/profile/useCases';
import { asyncStorageSessionStore } from '../data/auth/AsyncStorageSessionStore';
import { httpMyTicketsGateway } from '../data/myTickets/HttpMyTicketsGateway';
import { httpProfileDashboardGateway } from '../data/profile/HttpProfileDashboardGateway';
import { httpReservationsGateway } from '../data/reservations/HttpReservationsGateway';

export const loadProfileDashboard = createLoadProfileDashboard(
  httpProfileDashboardGateway,
  httpMyTicketsGateway,
  httpReservationsGateway,
  asyncStorageSessionStore.getToken,
);
