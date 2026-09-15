# Roamwise trip format · v2

A trip is UTF-8 YAML with `schema: roamwise/v2`. Prefer `destination-trip.yaml`; `.trip.yaml`, `.yml`, and `.yaml` also work. Quote dates and times. Maximum size is 2 MiB, with at most 2,000 items per list and 200 calendar days per trip. YAML aliases, duplicate keys, unknown fields, unsafe URL schemes, and duplicate IDs are rejected.

## Minimal document

```yaml
schema: roamwise/v2
trip:
  title: A weekend in Seville
  dates: { start: '2027-04-09', end: '2027-04-12' }
  travellers: 2
  currency: EUR
  origin: { name: Madrid, code: MAD }
  destination:
    name: Seville
    code: SVQ
    coordinates: { lat: 37.3891, lng: -5.9845 }
activities:
  - id: plaza-espana
    name: Explore Plaza de España
    date: '2027-04-10'
    time: '10:00'
    end_time: '11:30'
    coordinates: { lat: 37.3772, lng: -5.9869 }
    price_total: 0
selected:
  activities: [plaza-espana]
```

Only `schema` and `trip` are required at the top level. Empty sections default to empty lists/objects. Metadata defaults: title and place names `''`, dates `''`, travellers `1`, currency `EUR`. Empty dates represent an unfinished plan. Defaults apply only to missing fields, never to wrong types. IDs must be globally unique strings of letters, digits, underscores, and hyphens, start with a letter or digit, and be at most 120 characters. Reference IDs exactly in `selected`.

## Fields

`trip`: `title`, `dates: {start, end}`, `travellers` (positive integer), `currency` (three uppercase currency letters), optional `budget_per_person`, `origin`, `destination`. Each place has `name`, optional `code` and `coordinates: {lat, lng}`. Latitude is -90…90, longitude -180…180.

`flights`: `outbound: []`, `return: []`, optional `provider`, `updated_at` (ISO timestamp). Each flight requires `id`, `airline`, `from`, `to`, `depart`, `arrive`. Optional: `flight_number`, `price_per_person`, `url`, `live` (boolean), `fare_source`, `price_updated_at`. Times use ISO date-times; include an offset, such as `2027-04-09T10:20:00+01:00`. UTC offsets are required. Arrival must not precede departure. Each entry is an alternative; select one outbound and one return.

`stays`: a list of options, each requiring `id`, `name`. Optional: `type`, `address`, `coordinates`, `price_total`, `rating` (string), `url`, `image`, `images` (list), `notes`, `neighbourhood`, `amenities`, `pros`, `cons` (lists of strings), `check_in`, `check_out` (display strings), `cancellation_policy`, `bedrooms`, `bathrooms`, `size_m2` (nonnegative numbers). The selected stay spans the trip dates. Multiple dated accommodation segments are not part of v2.

`activities`: each requires `id`, `name`. Optional: `date` (`YYYY-MM-DD`), `time`, `end_time` (`HH:mm`), `order` (nonnegative integer), `category`, `address`, `coordinates`, `price_total`, `cost_label`, `url`, `image`, `notes`. Categories are free-form; common values are `food`, `sight`, `transport`, `outdoor`, `shopping`. Without a date an activity appears in Unscheduled. An end time earlier than the start time represents an overnight activity. Order overrides chronological ordering for activities. Only selected activities contribute to costs and the final printable itinerary.

`selected`: optional `outbound_flight`, `return_flight`, `stay` (option IDs), `activities` (list of activity IDs, defaults to empty). Nothing is booked or selected automatically.

All prices use the trip currency. Flight prices are per person; stay prices are for the entire stay and group; activity prices are for the entire group. Prices are nonnegative numbers. Omit an unknown price; `0` means free. Subtotals include known selected prices only. Record estimated costs in notes/cost labels or flight `fare_source`; do not present estimates as verified quotes.

Links must use HTTP or HTTPS without embedded credentials. Images must use HTTPS and are optional. Images are not downloaded or bundled by the CLI. Missing coordinates omit a map pin, not the itinerary entry. The viewer does not infer or geocode coordinates during basic rendering.

## Validation

`roamwise validate path/to/trip.yaml --json` returns `valid`, `errors`, and `warnings`. Each issue includes a field `path` and a `message`; YAML syntax errors may also include line and column. Exit codes: 0 valid, 1 invalid, 2 operational error. The website uses the same validator.

The JSON Schema is at `/trip.schema.json`. Roamwise additionally checks real calendar dates, date ranges, ID references, and flight chronology. Its JSON Schema custom formats are `trip-date` (calendar date or empty draft), `trip-datetime` (ISO timestamp, UTC offset required), `trip-url` (HTTP/HTTPS URL), and `trip-image` (HTTPS URL).

The CLI never rewrites a file during validation or preview.
