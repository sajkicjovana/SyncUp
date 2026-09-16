export type EventPin = {
  id: number;
  eventId: number;
  latitude: number;
  longitude: number;
  label: string;
  description: string;
  pinnedAt: string;
  pinCategory: number;
};

export type PinCategory = {
  id: number;
  name: string;
};
