import type { FavoriteEvent, FavoriteIntent } from '../../domain/favorites';

export type FavoritesResponse =
  | { ok: true; events: FavoriteEvent[] }
  | { ok: false; status: number };

export type FavoriteMutationResponse =
  | { ok: true }
  | { ok: false; text: string };

export interface FavoritesGateway {
  getFavorites(token: string): Promise<FavoritesResponse>;
  changeFavorite(token: string, eventId: number, intent: FavoriteIntent): Promise<FavoriteMutationResponse>;
}

export type ReadFavoritesToken = () => Promise<string | null>;
