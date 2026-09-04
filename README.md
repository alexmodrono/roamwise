# Roamwise

A lightweight trip-comparison board for choosing flights, accommodation and optional activities together. It keeps the total and per-person cost visible as options change, maps every location, and generates a print-ready final itinerary.

The included example uses a Madrid to Edinburgh weekend. Trips use the portable `roamwise/v2` YAML format, and custom options and selections are saved in the browser.

## Trip files

Load, drop, edit or generate a `.trip.yaml` file following `public/trips/edinburgh.trip.yaml`. A trip contains metadata, flights, stays, activities and selected option IDs. Locations use `{ lat, lng }` coordinates.

## Maps and listing imports

OpenStreetMap works by default. Apple Maps support accepts an origin-restricted MapKit JS token in the map settings and keeps it in the local browser. Booking.com and Airbnb links are safely unfurled through the `/api/unfurl` route; when a provider blocks automated metadata, Roamwise creates an editable fallback entry.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## License

MIT
