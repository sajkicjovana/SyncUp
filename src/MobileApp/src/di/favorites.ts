import { createFavoritesUseCases } from '../application/favorites/useCases';
import { asyncStorageSessionStore } from '../data/auth/AsyncStorageSessionStore';
import { httpFavoritesGateway } from '../data/favorites/HttpFavoritesGateway';

export const favoritesUseCases = createFavoritesUseCases(
  httpFavoritesGateway,
  asyncStorageSessionStore.getToken,
);
