const FAVORITES_STORAGE_KEY = 'swimmer_favorites';

export function loadFavorites(): Set<string> {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!stored) return new Set();
    const favorites = JSON.parse(stored);
    return new Set(favorites);
  } catch (error) {
    console.error('Failed to load favorites:', error);
    return new Set();
  }
}

export function saveFavorites(favorites: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
  } catch (error) {
    console.error('Failed to save favorites:', error);
  }
}

export function addFavorite(contextId: string): void {
  const favorites = loadFavorites();
  favorites.add(contextId);
  saveFavorites(favorites);
}

export function removeFavorite(contextId: string): void {
  const favorites = loadFavorites();
  favorites.delete(contextId);
  saveFavorites(favorites);
}

export function isFavorite(contextId: string): boolean {
  const favorites = loadFavorites();
  return favorites.has(contextId);
}

export function toggleFavorite(contextId: string): void {
  if (isFavorite(contextId)) {
    removeFavorite(contextId);
  } else {
    addFavorite(contextId);
  }
}
