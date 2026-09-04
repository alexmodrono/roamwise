import YAML from 'yaml';

export type Coordinates = { lat: number; lng: number };
export type FlightLeg = {
  id: string;
  airline: string;
  flight_number?: string;
  from: string;
  to: string;
  depart: string;
  arrive: string;
  price_per_person: number;
  url?: string;
  live?: boolean;
};
export type Stay = {
  id: string; name: string; type?: string; address?: string; coordinates?: Coordinates;
  price_total: number; rating?: string; url?: string; image?: string; images?: string[];
};
export type Activity = {
  id: string; name: string; date?: string; time?: string; address?: string;
  coordinates?: Coordinates; price_total: number; url?: string; image?: string;
};
export type TripDocument = {
  schema: 'roamwise/v2';
  trip: {
    title: string; dates: { start: string; end: string }; travellers: number;
    currency: string; budget_per_person?: number;
    origin: { name: string; code?: string; coordinates?: Coordinates };
    destination: { name: string; code?: string; coordinates?: Coordinates };
  };
  flights: { outbound: FlightLeg[]; return: FlightLeg[]; updated_at?: string; provider?: string };
  stays: Stay[];
  activities: Activity[];
  selected: { outbound_flight?: string; return_flight?: string; stay?: string; activities: string[] };
};

export const DEFAULT_TRIP: TripDocument = {
  schema: 'roamwise/v2',
  trip: {
    title: 'Edinburgh weekend', dates: { start: '2026-11-13', end: '2026-11-16' }, travellers: 2,
    currency: 'EUR', budget_per_person: 300,
    origin: { name: 'Madrid', code: 'MAD', coordinates: { lat: 40.4983, lng: -3.5676 } },
    destination: { name: 'Edinburgh', code: 'EDI', coordinates: { lat: 55.95, lng: -3.3725 } },
  },
  flights: {
    provider: 'Ryanair', updated_at: '2026-09-04T14:00:00Z',
    outbound: [{ id: 'fr188-2026-11-13', airline: 'Ryanair', flight_number: 'FR188', from: 'MAD', to: 'EDI', depart: '2026-11-13T10:20:00', arrive: '2026-11-13T12:15:00', price_per_person: 27.99, live: true }],
    return: [{ id: 'fr5685-2026-11-16', airline: 'Ryanair', flight_number: 'FR5685', from: 'EDI', to: 'MAD', depart: '2026-11-16T19:45:00', arrive: '2026-11-16T23:40:00', price_per_person: 27.99, live: true }],
  },
  stays: [
    { id: 'dryden', name: 'Dryden Gardens', type: 'Private double room', address: 'Broughton, Edinburgh', coordinates: { lat: 55.97, lng: -3.185 }, price_total: 274, rating: '9.2', url: 'https://www.booking.com/hotel/gb/dryden-gardens.html?checkin=2026-11-13&checkout=2026-11-16&group_adults=2&no_rooms=1', image: '/stays/dryden.jpg' },
    { id: 'lavender', name: 'Lavender Guest House', type: 'Double room · en-suite', address: 'South Edinburgh', coordinates: { lat: 55.935, lng: -3.177 }, price_total: 310, rating: '8.9', url: 'https://www.booking.com/hotel/gb/lavender-guest-house-edinburgh.html?checkin=2026-11-13&checkout=2026-11-16&group_adults=2&no_rooms=1', image: '/stays/lavender.jpg' },
    { id: 'moon', name: 'Moon suite apart', type: 'Entire 1-bed apartment · 47 m²', address: 'Grange, Edinburgh', coordinates: { lat: 55.936, lng: -3.19 }, price_total: 324, rating: 'New', url: 'https://www.booking.com/searchresults.html?ss=Moon%20suite%20apart%2C%20Edinburgh', image: '/stays/moon.jpg' },
    { id: 'suite', name: 'Suite 3 En-suite', type: 'Private en-suite double', address: 'Central Edinburgh', coordinates: { lat: 55.953, lng: -3.188 }, price_total: 344, rating: '9.0', url: 'https://www.booking.com/searchresults.html?ss=Suite%203%20En-suite%20Room%20Edinburgh', image: '/stays/suite.jpg' },
  ],
  activities: [],
  selected: { outbound_flight: 'fr188-2026-11-13', return_flight: 'fr5685-2026-11-16', stay: 'dryden', activities: [] },
};

type LegacyTrip = Record<string, any>;
function migrateV1(value: LegacyTrip): TripDocument {
  const roundTrips = Array.isArray(value.flights) ? value.flights : [];
  const outbound: FlightLeg[] = roundTrips.map((item: any, index: number) => ({ id: `${item.id || 'flight'}-out`, airline: item.airline || 'Airline', from: item.outbound?.from || value.trip?.origin?.code || '', to: item.outbound?.to || value.trip?.destination?.code || '', depart: item.outbound?.depart || '', arrive: item.outbound?.arrive || '', price_per_person: Number(item.price_per_person || 0) / 2, url: item.url })).filter((item: FlightLeg) => item.depart);
  const returns: FlightLeg[] = roundTrips.map((item: any) => ({ id: `${item.id || 'flight'}-return`, airline: item.airline || 'Airline', from: item.return?.from || value.trip?.destination?.code || '', to: item.return?.to || value.trip?.origin?.code || '', depart: item.return?.depart || '', arrive: item.return?.arrive || '', price_per_person: Number(item.price_per_person || 0) / 2, url: item.url })).filter((item: FlightLeg) => item.depart);
  return { ...value, schema: 'roamwise/v2', flights: { outbound, return: returns }, selected: { outbound_flight: outbound[0]?.id, return_flight: returns[0]?.id, stay: value.selected?.stay, activities: value.selected?.activities ?? [] } } as TripDocument;
}

export function parseTrip(source: string): TripDocument {
  let value = YAML.parse(source) as LegacyTrip;
  if (value?.schema === 'roamwise/v1') value = migrateV1(value);
  if (!value || value.schema !== 'roamwise/v2') throw new Error('Expected schema: roamwise/v2');
  if (!value.trip?.title || !value.trip?.dates || !Number.isFinite(value.trip?.travellers)) throw new Error('Trip title, dates and travellers are required');
  value.flights ??= { outbound: [], return: [] }; value.flights.outbound ??= []; value.flights.return ??= [];
  value.stays ??= []; value.activities ??= [];
  value.selected ??= { activities: [] }; value.selected.activities ??= [];
  return value as TripDocument;
}

export function stringifyTrip(trip: TripDocument) { return YAML.stringify(trip, { lineWidth: 0 }); }
