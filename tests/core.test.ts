import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateTrip, parseTrip, stringifyTrip, EMPTY_TRIP, MAX_TRIP_BYTES } from '../packages/core/trip-schema';
import { calculateCosts } from '../packages/core/costs';
import { buildItinerary } from '../packages/core/itinerary';
const minimal = readFileSync('skills/roamwise/assets/minimal-trip.yaml', 'utf8');
function check(mutator: (trip: ReturnType<typeof parseTrip>) => void) { const trip = parseTrip(minimal); mutator(trip); return validateTrip(stringifyTrip(trip)); }

void test('minimal, complete, and blank documents round-trip without losing selections', () => {
  for (const source of [minimal, readFileSync('public/trips/edinburgh.trip.yaml', 'utf8'), stringifyTrip(EMPTY_TRIP)]) {
    const trip = parseTrip(source);
    assert.deepEqual(parseTrip(stringifyTrip(trip)), trip);
  }
});
void test('defaults support short agent documents without coercing malformed types', () => {
  const trip = parseTrip('schema: roamwise/v2\ntrip: {}');
  assert.equal(trip.trip.travellers, 1); assert.deepEqual(trip.activities, []);
  for (const input of ['flights: false', 'stays: [1]', 'selected: {activities: nope}', 'activities: [{id: 4, name: Castle}]']) assert.equal(validateTrip(`schema: roamwise/v2\ntrip: {}\n${input}`).valid, false);
  assert.equal(validateTrip('schema: roamwise/v2\ntrip: {travellers: "2"}').valid, false);
});
void test('syntax errors include useful locations and unsafe trees are rejected', () => {
  assert.equal(validateTrip('schema: [').errors[0].line, 1);
  for (const source of ['schema: roamwise/v2\nschema: roamwise/v2\ntrip: {}', 'schema: roamwise/v2\ntrip: &a {title: *a}', 'schema: roamwise/v999\ntrip: {}', 'x'.repeat(MAX_TRIP_BYTES + 1)]) assert.equal(validateTrip(source).valid, false);
});
void test('nested values, real dates, safe URLs, and coordinate ranges are checked', () => {
  for (const [path, mutate] of [
    ['activities[0].coordinates.lat', (trip: ReturnType<typeof parseTrip>) => { trip.activities[0].coordinates!.lat = 100; }],
    ['activities[0].time', (trip: ReturnType<typeof parseTrip>) => { trip.activities[0].time = 'after lunch'; }],
    ['trip.dates.start', (trip: ReturnType<typeof parseTrip>) => { trip.trip.dates.start = '2026-02-30'; }],
    ['trip.dates.end', (trip: ReturnType<typeof parseTrip>) => { trip.trip.dates.end = '2025-01-01'; }],
    ['activities[0].url', (trip: ReturnType<typeof parseTrip>) => { trip.activities[0].url = 'javascript:alert(1)'; }],
    ['activities[0].image', (trip: ReturnType<typeof parseTrip>) => { trip.activities[0].image = '//evil.example/x.png'; }],
    ['activities[0].price_total', (trip: ReturnType<typeof parseTrip>) => { trip.activities[0].price_total = -1; }],
  ] as const) assert.ok(check(mutate).errors.some(issue => issue.path === path), path);
});
void test('IDs are unique and selections must resolve to the matching group', () => {
  assert.ok(check(trip => trip.activities.push({ ...trip.activities[0] })).errors.some(issue => issue.path === 'activities[1].id'));
  assert.ok(check(trip => { trip.selected.stay = 'royal-mile'; }).errors.some(issue => issue.path === 'selected.stay'));
  assert.ok(check(trip => { trip.selected.activities = ['missing']; }).errors.some(issue => issue.path === 'selected.activities[0]'));
});
void test('missing prices are unknown, zero is free, and only selected prices count', () => {
  const trip = parseTrip(minimal);
  trip.stays.push({ id: 'hotel', name: 'Hotel' }); trip.selected.stay = 'hotel';
  trip.activities.push({ id: 'unselected', name: 'Expensive tour', price_total: 1000 });
  assert.deepEqual(calculateCosts(trip), { travel: 0, travelPerPerson: 0, activities: 0, total: 0, unknown: 1 });
  assert.equal(parseTrip(stringifyTrip(trip)).stays[0].price_total, undefined);
  trip.stays[0].price_total = 200;
  assert.equal(calculateCosts(trip).travelPerPerson, 100); assert.equal(calculateCosts(trip).unknown, 0);
});
void test('missing locations warn and do not block itinerary rendering', () => {
  const result = check(trip => { delete trip.activities[0].coordinates; });
  assert.equal(result.valid, true); assert.ok(result.warnings.some(issue => issue.path.endsWith('coordinates')));
  assert.equal(buildItinerary(result.trip!)[1].events[0].id, 'royal-mile');
});
void test('day construction includes DST boundaries and orders activity times', () => {
  const trip = parseTrip(minimal);
  trip.trip.dates = { start: '2026-10-24', end: '2026-10-26' };
  trip.activities = [{ id: 'late', name: 'Dinner', date: '2026-10-25', time: '19:00' }, { id: 'early', name: 'Breakfast', date: '2026-10-25', time: '08:00' }];
  const days = buildItinerary(trip);
  assert.deepEqual(days.map(day => day.date), ['2026-10-24', '2026-10-25', '2026-10-26']);
  assert.deepEqual(days[1].events.map(event => event.id), ['early', 'late']);
});
void test('flight chronology respects offsets; legacy migration preserves selection', () => {
  const trip = parseTrip(minimal);
  trip.flights.outbound = [{ id: 'flight', airline: 'Example', from: 'MAD', to: 'EDI', depart: '2026-11-13T10:00:00+01:00', arrive: '2026-11-13T09:30:00Z' }];
  assert.equal(validateTrip(stringifyTrip(trip)).valid, true);
  trip.flights.outbound[0].arrive = '2026-11-13T08:30:00Z';
  assert.ok(validateTrip(stringifyTrip(trip)).errors.some(issue => issue.path.endsWith('arrive')));
  const legacy = { schema: 'roamwise/v1', trip: trip.trip, flights: [{ id: 'round', airline: 'Example', price_per_person: 100, outbound: { from: 'MAD', to: 'EDI', depart: '2026-11-13T10:00:00+01:00', arrive: '2026-11-13T12:00:00Z' }, return: { from: 'EDI', to: 'MAD', depart: '2026-11-16T10:00:00Z', arrive: '2026-11-16T14:00:00+01:00' } }], selected: { flight: 'round' } };
  const result = validateTrip(JSON.stringify(legacy));
  assert.equal(result.valid, true, JSON.stringify(result.errors)); assert.equal(result.trip!.selected.outbound_flight, 'round-out'); assert.equal(result.trip!.flights.outbound[0].price_per_person, 50); assert.ok(result.warnings.some(issue => issue.path === 'schema'));
});
