export type FavoriteEvent = {
  id: number;
  title: string;
  location: string;
  imageUrl: string;
  startDate: string;
  attendingCount: number;
};

export type FavoriteIntent = 'add' | 'remove';

export function favoriteIds(events: FavoriteEvent[]): number[] {
  return events.map((event) => event.id);
}

export function favoriteIntent(ids: number[], eventId: number): FavoriteIntent {
  return ids.includes(eventId) ? 'remove' : 'add';
}
