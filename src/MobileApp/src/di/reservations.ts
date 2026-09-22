import { createLoadMyReservations } from '../application/reservations/useCases';
import { asyncStorageSessionStore } from '../data/auth/AsyncStorageSessionStore';
import { httpReservationsGateway } from '../data/reservations/HttpReservationsGateway';

export const loadMyReservations = createLoadMyReservations(
  httpReservationsGateway,
  asyncStorageSessionStore.getToken,
);
