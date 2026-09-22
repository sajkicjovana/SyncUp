import { createLoadCartDisplayData, createPurchaseStandardCart, createReserveResourcesWithoutTicket } from '../application/cart/useCases';
import { httpCartDisplayGateway } from '../data/cart/HttpCartDisplayGateway';
import { httpCartResourceReservationGateway } from '../data/cart/HttpCartResourceReservationGateway';
import { httpCartTicketPurchaseGateway } from '../data/cart/HttpCartTicketPurchaseGateway';

export const loadCartDisplayData = createLoadCartDisplayData(httpCartDisplayGateway);
export const reserveResourcesWithoutTicket = createReserveResourcesWithoutTicket(httpCartResourceReservationGateway);
export const purchaseStandardCart = createPurchaseStandardCart(httpCartTicketPurchaseGateway, httpCartResourceReservationGateway);
