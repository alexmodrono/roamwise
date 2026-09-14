import type { TripDocument } from './trip-schema';

export function calculateCosts(trip: TripDocument) {
  const flights = [trip.flights.outbound.find(item => item.id === trip.selected.outbound_flight), trip.flights.return.find(item => item.id === trip.selected.return_flight)].filter(item => item !== undefined);
  const stay = trip.stays.find(item => item.id === trip.selected.stay);
  const activities = trip.activities.filter(item => trip.selected.activities.includes(item.id));
  const travel = flights.reduce((sum, flight) => sum + (flight.price_per_person ?? 0) * trip.trip.travellers, 0) + (stay?.price_total ?? 0);
  const activityTotal = activities.reduce((sum, item) => sum + (item.price_total ?? 0), 0);
  const unknown = flights.filter(item => item.price_per_person === undefined).length + (stay && stay.price_total === undefined ? 1 : 0) + activities.filter(item => item.price_total === undefined).length;
  return { travel, travelPerPerson: travel / trip.trip.travellers, activities: activityTotal, total: travel + activityTotal, unknown };
}
