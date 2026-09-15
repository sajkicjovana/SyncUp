import React, { createContext, useContext, useEffect, useState } from 'react';
import { favoritesUseCases } from '../../src/di/favorites';
type FavoriteContextType = {
  favorites: number[];
  toggleFavorite: (eventId: number) => Promise<void>;
  loadFavorites: () => Promise<void>;
  clearFavorites: () => void;
  isGuest: boolean;
  setGuestMode: (value: boolean) => void;
};

const FavoriteContext = createContext<FavoriteContextType>({
  favorites: [],
  toggleFavorite: async () => {},
  loadFavorites: async () => {},
  clearFavorites: () => {},
  isGuest: false,
  setGuestMode: () => {},
});

export const FavoriteProvider = ({ children }: { children: React.ReactNode }) => {
  const [favorites, setFavorites] = useState<number[]>([]);
  const [isGuest, setIsGuest] = useState(false);

  const setGuestMode = (value: boolean) => {
    setIsGuest(value);
  };

  const clearFavorites = () => {
    setFavorites([]);
  };

  const loadFavorites = async () => {
    try {
      const result = await favoritesUseCases.loadFavoriteIds();
      if (result.kind === 'loaded') {
        setFavorites(result.ids);
      }
    } catch (err) {
      console.error('Failed to load favorites:', err);
    }
  };

  const toggleFavorite = async (eventId: number) => {
    try {
      const result = await favoritesUseCases.toggleFavorite(eventId, favorites);
      if (result.kind === 'changed') {
        await loadFavorites();
      } else if (result.kind === 'rejected') {
        console.error('Failed to toggle favorite:', result.text);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  return (
    <FavoriteContext.Provider
      value={{
        favorites,
        toggleFavorite,
        loadFavorites,
        clearFavorites,
        isGuest,
        setGuestMode,
      }}
    >
      {children}
    </FavoriteContext.Provider>
  );
};

export const useFavorites = () => useContext(FavoriteContext);
export default FavoriteProvider;
