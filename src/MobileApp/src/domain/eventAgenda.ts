export type EventAgendaEvent = {
  eventId: number;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  imageUrl: string;
  parentEventId: number;
  description: string;
};

export type EventAgendaActivity = {
  activityId: number;
  eventId: number;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
  category: string;
};

export type EventAgendaResponse = {
  eventsAndSubevents: EventAgendaEvent[];
  activities: EventAgendaActivity[];
};
