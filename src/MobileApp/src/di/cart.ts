import { createLoadCartDisplayData, createReserveResourcesWithoutTicket } from '../application/cart/useCases';
import { httpCartDisplayGateway } from '../data/cart/HttpCartDisplayGateway';
import { httpCartResourceReservationGateway } from '../data/cart/HttpCartResourceReservationGateway';

export const loadCartDisplayData = createLoadCartDisplayData(httpCartDisplayGateway);
export const reserveResourcesWithoutTicket = createReserveResourcesWithoutTicket(httpCartResourceReservationGateway);
