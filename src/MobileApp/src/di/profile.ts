import {
  createLoadPersonalInfo,
  createLoadProfileDashboard,
  createSavePersonalInfo,
} from '../application/profile/useCases';
import { asyncStorageSessionStore } from '../data/auth/AsyncStorageSessionStore';
import { httpMyTicketsGateway } from '../data/myTickets/HttpMyTicketsGateway';
import { httpProfileDashboardGateway } from '../data/profile/HttpProfileDashboardGateway';
import { httpPersonalInfoGateway } from '../data/profile/HttpPersonalInfoGateway';
import { httpReservationsGateway } from '../data/reservations/HttpReservationsGateway';

export const loadProfileDashboard = createLoadProfileDashboard(
  httpProfileDashboardGateway,
  httpMyTicketsGateway,
  httpReservationsGateway,
  asyncStorageSessionStore.getToken,
);

export const loadPersonalInfo = createLoadPersonalInfo(
  httpProfileDashboardGateway,
  asyncStorageSessionStore.getToken,
);

export const savePersonalInfo = createSavePersonalInfo(
  httpPersonalInfoGateway,
  asyncStorageSessionStore.getToken,
);
