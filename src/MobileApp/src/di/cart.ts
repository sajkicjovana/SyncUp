import { createLoadCartDisplayData } from '../application/cart/useCases';
import { httpCartDisplayGateway } from '../data/cart/HttpCartDisplayGateway';

export const loadCartDisplayData = createLoadCartDisplayData(httpCartDisplayGateway);
