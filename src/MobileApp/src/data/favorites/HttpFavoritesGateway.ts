import { API_URL, apiCall } from '../../../config';
import type { FavoritesGateway } from '../../application/favorites/ports';

export const httpFavoritesGateway: FavoritesGateway = {
  async getFavorites(token) {
    const response = await apiCall(`${API_URL}/api/favorites`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, events: await response.json() };
  },

  async changeFavorite(token, eventId, intent) {
    const response = await apiCall(`${API_URL}/api/Favorites`, {
      method: intent === 'remove' ? 'DELETE' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(eventId),
    });
    if (!response.ok) return { ok: false, text: await response.text() };
    return { ok: true };
  },
};
