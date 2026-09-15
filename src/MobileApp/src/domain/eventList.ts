export type EventListItem = {
  id: number;
  title: string;
  location: string;
  imageUrl: string;
  startDate: string;
  endDate: string;
  parentEventId?: number | string | null;
};

export function selectBrowsableEvents(events: EventListItem[], now: Date): EventListItem[] {
  return events.filter((event) => {
    const parentId = event.parentEventId;
    const endDate = new Date(event.endDate);
    // Keep the baseline coercion and inclusive end-time comparison.
    const parentIdNum = Number(parentId);
    return parentIdNum === 0 && endDate >= now;
  });
}
