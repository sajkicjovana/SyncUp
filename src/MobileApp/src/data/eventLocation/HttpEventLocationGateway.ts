import { apiCall } from '../../../config';
import type { EventLocationGateway } from '../../application/eventLocation/ports';

export const httpEventLocationGateway: EventLocationGateway = {
  async geocodeLocation(location) {
    const response = await apiCall(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`,
      {
        headers: {
          'User-Agent': 'SyncUpApp/1.0 (support@syncupapp.com)',
          'Accept-Language': 'en',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data || data.length === 0) return null;

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
    };
  },
};
