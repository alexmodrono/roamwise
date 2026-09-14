import { isDate, type TripDocument, type FlightLeg, type Activity } from './trip-schema';

export type DayEvent =
  | { kind: 'flight'; id: string; flight: FlightLeg; direction: 'outbound' | 'return'; selected: boolean }
  | { kind: 'milestone'; id: string; label: string; detail?: string; timeText?: string; icon: 'door-open' | 'door-closed' | 'plane' }
  | { kind: 'activity'; id: string; activity: Activity; selected: boolean };
export type DayPlan = { date: string; index: number; events: DayEvent[] };

export function buildItinerary(trip: TripDocument): DayPlan[] {
  const dates = new Set<string>();
  const push = (value?: string) => { if (isDate(value)) dates.add(value as string); };
  const { start, end } = trip.trip.dates;
  if (isDate(start) && isDate(end) && start! <= end!) {
    const cursor = new Date(`${start}T12:00:00Z`);
    const last = new Date(`${end}T12:00:00Z`);
    for (let index = 0; index < 200 && cursor <= last; index++) { push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  }
  trip.flights.outbound.forEach((item) => push(item.depart?.slice(0, 10)));
  trip.flights.return.forEach((item) => push(item.depart?.slice(0, 10)));
  trip.activities.forEach((item) => push(item.date));
  return [...dates].sort().map((date, index) => {
    const events: DayEvent[] = [];
    ([...trip.flights.outbound.map((flight) => ({ flight, direction: 'outbound' as const })), ...trip.flights.return.map((flight) => ({ flight, direction: 'return' as const }))]
      .filter(({ flight }) => flight.depart?.slice(0, 10) === date))
      .forEach(({ flight, direction }) => {
        const selected = (direction === 'outbound' ? trip.selected.outbound_flight : trip.selected.return_flight) === flight.id;
        events.push({ kind: 'flight', id: flight.id, flight, direction, selected });
      });
    const stay = trip.stays.find((item) => item.id === trip.selected.stay);
    if (stay) {
      if (date === start) events.push({ kind: 'milestone', id: `checkin-${stay.id}`, label: `Check in · ${stay.name}`, detail: stay.address, timeText: stay.check_in, icon: 'door-open' });
      if (date === end && end !== start) events.push({ kind: 'milestone', id: `checkout-${stay.id}`, label: `Check out · ${stay.name}`, timeText: stay.check_out, icon: 'door-closed' });
    }
    trip.activities.filter((item) => item.date === date).forEach((item) => events.push({ kind: 'activity', id: item.id, activity: item, selected: trip.selected.activities.includes(item.id) }));
    events.sort((a, b) => a.kind === 'activity' && b.kind === 'activity' ? compareActivities(a.activity, b.activity) : eventSortKey(a).localeCompare(eventSortKey(b)));
    return { date, index: index + 1, events };
  });
}
function eventSortKey(event: DayEvent): string {
  if (event.kind === 'flight') return event.flight.depart.slice(11, 16) || '00:00';
  if (event.kind === 'milestone') return event.timeText ?? (event.icon === 'door-closed' ? '11:00' : event.icon === 'plane' ? '23:59' : '15:00');
  return event.activity.time ?? '99:99';
}
export function compareActivities(a: Activity, b: Activity) {
  if (a.order != null && b.order != null) return a.order - b.order;
  if (a.order != null) return -1;
  if (b.order != null) return 1;
  return (a.time ?? '99:99').localeCompare(b.time ?? '99:99');
}
