import { favoriteIds, favoriteIntent } from '../../domain/favorites';
import type { FavoriteIntent } from '../../domain/favorites';
import type { FavoritesGateway, ReadFavoritesToken } from './ports';

export function createFavoritesUseCases(gateway: FavoritesGateway, readToken: ReadFavoritesToken) {
  const loadFavoriteEvents = (token: string) => gateway.getFavorites(token);

  // Presentation can retain an already-read token and its own guest/error UI boundary.
  const mutateFavoriteWithToken = (eventId: number, intent: FavoriteIntent, token: string) =>
    gateway.changeFavorite(token, eventId, intent);

  const loadFavoriteIds = async () => {
    const token = await readToken();
    if (!token) return { kind: 'no-token' } as const;
    const result = await loadFavoriteEvents(token);
    if (!result.ok) return { kind: 'rejected', status: result.status } as const;
    return { kind: 'loaded', ids: favoriteIds(result.events) } as const;
  };

  const toggleFavorite = async (eventId: number, ids: number[]) => {
    const token = await readToken();
    if (!token) return { kind: 'no-token' } as const;
    const result = await mutateFavoriteWithToken(eventId, favoriteIntent(ids, eventId), token);
    if (!result.ok) return { kind: 'rejected', text: result.text } as const;
    // The provider owns refresh and its second token read.
    return { kind: 'changed' } as const;
  };

  // Callers retain their existing, different storage/error handling boundaries.
  return { readToken, loadFavoriteEvents, loadFavoriteIds, mutateFavoriteWithToken, toggleFavorite };
}
