import YAML from 'yaml';

export type Coordinates = { lat: number; lng: number };
export type Flight = {
  id: string;
  airline: string;
  price_per_person: number;
  url?: string;
  outbound: { from: string; to: string; depart: string; arrive: string };
  return: { from: string; to: string; depart: string; arrive: string };
};
export type Stay = {
  id: string;
  name: string;
  type?: string;
  address?: string;
  coordinates?: Coordinates;
  price_total: number;
  rating?: string;
  url?: string;
  image?: string;
};
export type Activity = {
  id: string;
  name: string;
  date?: string;
  time?: string;
  address?: string;
  coordinates?: Coordinates;
  price_total: number;
  url?: string;
  image?: string;
};
export type TripDocument = {
  schema: 'roamwise/v1';
  trip: {
    title: string;
    dates: { start: string; end: string };
    travellers: number;
    currency: string;
    budget_per_person?: number;
    origin: { name: string; code?: string; coordinates?: Coordinates };
    destination: { name: string; code?: string; coordinates?: Coordinates };
  };
  flights: Flight[];
  stays: Stay[];
  activities: Activity[];
  selected: { flight?: string; stay?: string; activities: string[] };
};

export const DEFAULT_TRIP: TripDocument = {
  schema: 'roamwise/v1',
  trip: {
    title: 'Edinburgh weekend',
    dates: { start: '2026-11-13', end: '2026-11-16' },
    travellers: 2,
    currency: 'EUR',
    budget_per_person: 300,
    origin: { name: 'Madrid', code: 'MAD', coordinates: { lat: 40.4983, lng: -3.5676 } },
    destination: { name: 'Edinburgh', code: 'EDI', coordinates: { lat: 55.95, lng: -3.3725 } },
  },
  flights: [{
    id: 'ryanair-direct', airline: 'Ryanair', price_per_person: 81.8,
    url: 'https://www.ryanair.com/es/es/trip/flights/select?adults=2&dateOut=2026-11-13&dateIn=2026-11-16&originIata=MAD&destinationIata=EDI',
    outbound: { from: 'MAD', to: 'EDI', depart: '2026-11-13T10:20', arrive: '2026-11-13T12:15' },
    return: { from: 'EDI', to: 'MAD', depart: '2026-11-16T10:00', arrive: '2026-11-16T13:55' },
  }],
  stays: [
    { id: 'dryden', name: 'Dryden Gardens', type: 'Private double room', address: 'Broughton, Edinburgh', coordinates: { lat: 55.97, lng: -3.185 }, price_total: 274, rating: '9.2', url: 'https://www.booking.com/hotel/gb/dryden-gardens.html?checkin=2026-11-13&checkout=2026-11-16&group_adults=2&no_rooms=1', image: '/stays/dryden.jpg' },
    { id: 'lavender', name: 'Lavender Guest House', type: 'Double room · en-suite', address: 'South Edinburgh', coordinates: { lat: 55.935, lng: -3.177 }, price_total: 310, rating: '8.9', url: 'https://www.booking.com/hotel/gb/lavender-guest-house-edinburgh.html?checkin=2026-11-13&checkout=2026-11-16&group_adults=2&no_rooms=1', image: '/stays/lavender.jpg' },
    { id: 'moon', name: 'Moon suite apart', type: 'Entire 1-bed apartment · 47 m²', address: 'Grange, Edinburgh', coordinates: { lat: 55.936, lng: -3.19 }, price_total: 324, rating: 'New', url: 'https://www.booking.com/searchresults.html?ss=Moon%20suite%20apart%2C%20Edinburgh', image: '/stays/moon.jpg' },
    { id: 'suite', name: 'Suite 3 En-suite', type: 'Private en-suite double', address: 'Central Edinburgh', coordinates: { lat: 55.953, lng: -3.188 }, price_total: 344, rating: '9.0', url: 'https://www.booking.com/searchresults.html?ss=Suite%203%20En-suite%20Room%20Edinburgh', image: '/stays/suite.jpg' },
  ],
  activities: [],
  selected: { flight: 'ryanair-direct', stay: 'dryden', activities: [] },
};

export function parseTrip(source: string): TripDocument {
  const value = YAML.parse(source) as TripDocument;
  if (!value || value.schema !== 'roamwise/v1') throw new Error('Expected schema: roamwise/v1');
  if (!value.trip?.title || !value.trip?.dates || !Number.isFinite(value.trip?.travellers)) throw new Error('Trip title, dates and travellers are required');
  value.flights ??= [];
  value.stays ??= [];
  value.activities ??= [];
  value.selected ??= { activities: [] };
  value.selected.activities ??= [];
  return value;
}

export function stringifyTrip(trip: TripDocument) {
  return YAML.stringify(trip, { lineWidth: 0 });
}
