import { useState, useEffect, useCallback } from 'react';
import { NormalizedEvent, FavoriteSnapshot, STORAGE_KEYS } from '@eventspot/shared';

const STORAGE_KEY = STORAGE_KEYS.FAVORITES;

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteSnapshot[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Sync state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch (err) {
      console.error('Failed to save favorites to localStorage:', err);
    }
  }, [favorites]);

  const isFavorite = useCallback(
    (eventId: string) => {
      return favorites.some((f) => f.eventId === eventId);
    },
    [favorites]
  );

  const toggleFavorite = useCallback(
    (event: NormalizedEvent) => {
      setFavorites((prev) => {
        const exists = prev.some((f) => f.eventId === event.id);
        if (exists) {
          return prev.filter((f) => f.eventId !== event.id);
        } else {
          const snapshot: FavoriteSnapshot = {
            eventId: event.id,
            name: event.name,
            artistNames: event.artistNames,
            venue: event.venue.name,
            city: event.venue.city,
            startDateTime: event.startDateTime,
            priceRange: event.priceRange,
            ticketUrl: event.ticketUrl,
            imageUrl: event.imageUrl,
            savedAt: new Date().toISOString(),
          };
          return [snapshot, ...prev];
        }
      });
    },
    []
  );

  const removeFavorite = useCallback((eventId: string) => {
    setFavorites((prev) => prev.filter((f) => f.eventId !== eventId));
  }, []);

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    totalFavorites: favorites.length,
  };
}
