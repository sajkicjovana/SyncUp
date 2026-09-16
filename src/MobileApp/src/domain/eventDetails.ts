export type EventDetails = {
  id: number;
  title: string;
  imageUrl: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  organizerId: number;
  organizerName: string;
  attendingCount: number;
  isFavorite: boolean;
  minPrice: number | null;
  maxPrice: number | null;
};
