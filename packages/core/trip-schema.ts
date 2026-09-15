import { MAX_TRIP_BYTES } from './limits';
import YAML from 'yaml';
import type { ValidateFunction } from 'ajv';
import validateSchema from './trip-validator.generated.js';
export { isDate } from './formats.js';

export type Coordinates = { lat: number; lng: number };
export type FlightLeg = {
  id: string;
  airline: string;
  flight_number?: string;
  from: string;
  to: string;
  depart: string;
  arrive: string;
  price_per_person?: number;
  url?: string;
  live?: boolean;
  fare_source?: string;
  price_updated_at?: string;
};
export type Stay = {
  id: string; name: string; type?: string; address?: string; coordinates?: Coordinates;
  price_total?: number; rating?: string; url?: string; image?: string; images?: string[];
  notes?: string; neighbourhood?: string; amenities?: string[]; pros?: string[]; cons?: string[];
  check_in?: string; check_out?: string; cancellation_policy?: string;
  bedrooms?: number; bathrooms?: number; size_m2?: number;
};
export type Activity = {
  id: string; name: string; date?: string; time?: string; end_time?: string; order?: number; category?: string;
  address?: string; coordinates?: Coordinates; price_total?: number; cost_label?: string; url?: string; image?: string; notes?: string;
};
export type TripDetails = {
  title: string; dates: { start: string; end: string }; travellers: number;
  currency: string; budget_per_person?: number;
  origin: { name: string; code?: string; coordinates?: Coordinates };
  destination: { name: string; code?: string; coordinates?: Coordinates };
};
export type TripDocument = {
  schema: 'roamwise/v2';
  trip: TripDetails;
  flights: { outbound: FlightLeg[]; return: FlightLeg[]; updated_at?: string; provider?: string };
  stays: Stay[];
  activities: Activity[];
  selected: { outbound_flight?: string; return_flight?: string; stay?: string; activities: string[] };
};

export const EMPTY_TRIP: TripDocument = {
  schema: 'roamwise/v2',
  trip: {
    title: '', dates: { start: '', end: '' }, travellers: 1,
    currency: 'EUR',
    origin: { name: '' },
    destination: { name: '' },
  },
  flights: { outbound: [], return: [] },
  stays: [],
  activities: [],
  selected: { activities: [] },
};

export type TripIssue = { path: string; message: string; line?: number; column?: number };
export type TripValidation = { valid: boolean; trip?: TripDocument; errors: TripIssue[]; warnings: TripIssue[] };
export { MAX_TRIP_BYTES } from './limits';
const validate = validateSchema as ValidateFunction;

function issuePath(pointer: string): string {
  return pointer.split('/').slice(1).map((part, index) => /^\d+$/.test(part) ? `[${part}]` : `${index ? '.' : ''}${part.replace(/~1/g, '/').replace(/~0/g, '~')}`).join('') || '$';
}
export function validateTrip(source: string): TripValidation {
  const errors: TripIssue[] = [], warnings: TripIssue[] = [];
  if (new TextEncoder().encode(source).byteLength > MAX_TRIP_BYTES) return { valid: false, errors: [{ path: '$', message: 'Trip files must be smaller than 2 MiB' }], warnings };
  let value: unknown;
  try {
    const document = YAML.parseDocument(source, { uniqueKeys: true });
    if (document.errors.length) return { valid: false, errors: document.errors.map(error => ({ path: '$', message: error.message, line: error.linePos?.[0].line, column: error.linePos?.[0].col })), warnings };
    // Trip documents are trees. Reject aliases (including cycles) before converting.
    YAML.visit(document, { Alias() { throw new Error('YAML aliases are not supported; write the values directly'); } });
    value = document.toJS({ maxAliasCount: 0 });
  } catch (error) { return { valid: false, errors: [{ path: '$', message: error instanceof Error ? error.message : 'Invalid YAML' }], warnings }; }
  if (!validate(value)) {
    for (const error of validate.errors ?? []) {
      let path = issuePath(error.instancePath);
      const field = error.params.missingProperty ?? error.params.additionalProperty;
      if (field) path = path === '$' ? field : `${path}.${field}`;
      errors.push({ path, message: error.keyword === 'additionalProperties' ? 'Unknown field; see format.md' : error.message ?? 'Invalid value' });
    }
    return { valid: false, errors, warnings };
  }
  const trip = value as TripDocument;
  const { start, end } = trip.trip.dates;
  if (start && end && start > end) errors.push({ path: 'trip.dates.end', message: 'Must be on or after the start date' });
  if (start && end && (Date.parse(end) - Date.parse(start)) / 86400000 >= 200) errors.push({ path: 'trip.dates.end', message: 'Trips may span at most 200 days' });
  const groups = [ ['flights.outbound', trip.flights.outbound], ['flights.return', trip.flights.return], ['stays', trip.stays], ['activities', trip.activities] ] as const;
  const allIds = new Set<string>();
  for (const [group, items] of groups) for (const [index, item] of items.entries()) {
    const path = `${group}[${index}]`;
    if (allIds.has(item.id)) errors.push({ path: `${path}.id`, message: `Duplicate ID: ${item.id}` });
    allIds.add(item.id);
    if ('depart' in item) {
      if (Date.parse(item.arrive) < Date.parse(item.depart)) errors.push({ path: `${path}.arrive`, message: 'Arrival must not precede departure' });
      if (item.price_per_person === undefined) warnings.push({ path: `${path}.price_per_person`, message: 'Price unknown; excluded from the known cost subtotal' });
    } else {
      if (!item.coordinates) warnings.push({ path: `${path}.coordinates`, message: 'No coordinates; this item will appear in the itinerary but not as a map pin' });
      if (item.price_total === undefined) warnings.push({ path: `${path}.price_total`, message: 'Price unknown; excluded from the known cost subtotal' });
    }
  }
  for (const [field, items] of [['outbound_flight', trip.flights.outbound], ['return_flight', trip.flights.return], ['stay', trip.stays]] as const) {
    const selected = trip.selected[field];
    if (selected && !items.some(item => item.id === selected)) errors.push({ path: `selected.${field}`, message: `Unknown ID: ${selected}` });
  }
  trip.selected.activities.forEach((id, index) => { if (!trip.activities.some(item => item.id === id)) errors.push({ path: `selected.activities[${index}]`, message: `Unknown ID: ${id}` }); });
  trip.activities.forEach((item, index) => {
    if (item.date && ((start && item.date < start) || (end && item.date > end))) warnings.push({ path: `activities[${index}].date`, message: 'Activity falls outside the trip dates' });
    if (item.end_time && !item.time) warnings.push({ path: `activities[${index}].end_time`, message: 'End time has no start time' });
  });
  return { valid: errors.length === 0, trip: errors.length ? undefined : trip, errors, warnings };
}
export class TripValidationError extends Error {
  issues: TripIssue[];
  constructor(issues: TripIssue[]) { super(issues.map(issue => `${issue.path}: ${issue.message}`).join('\n')); this.name = 'TripValidationError'; this.issues = issues; }
}
export function parseTrip(source: string): TripDocument {
  const result = validateTrip(source);
  if (!result.trip) throw new TripValidationError(result.errors);
  return result.trip;
}
export function stringifyTrip(trip: TripDocument) { return YAML.stringify(trip, { lineWidth: 0, aliasDuplicateObjects: false }); }
