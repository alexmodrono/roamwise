# Roamwise

A time-oriented trip planner: compare flights, stays and activities, plan day by day, and keep the total and per-person cost visible as options change. It maps every location (OpenFreeMap with the custom Orchard theme, rendered by MapLibre GL) and generates a print-ready daily itinerary.

The app starts completely blank. Everything — trip metadata, flights, stays and the daily schedule — comes from a portable `roamwise/v2` `*-trip.yml` file, so the same app works for any trip.

## Trip files

Drop a `.trip.yaml` file anywhere on the page, load it with the **Load** button, edit the YAML view directly, or start blank and fill in the trip details. A trip contains metadata (dates, travellers, currency, origin/destination with IATA codes), flights, stays, activities (with `date`, `time` and `end_time` for scheduling) and selected option IDs. See `public/trips/seville.trip.yaml` for a complete example.

## Live flight fares

**Refresh live** pulls basic fares from Ryanair's public fare API for any route — set the origin and destination (name or IATA code) and travel dates in trip details. Fares for other airlines can always be added manually.

## Itinerary

Activities carry a date, start time and optional end time, so the planner groups them into day cards with a timeline, flight departures, stay check-in/check-out milestones and a per-day cost. Anything without a date lands in the *Unscheduled* pool until you schedule it. The final print view is a day-by-day itinerary.

## Maps and listing imports

All embedded maps use the custom Orchard style on OpenFreeMap with MapLibre GL, including stay previews and the printed itinerary. No API key or account is required. Stay previews capture a map image for reliable printing and retain the required attribution. Stay and activity links open OpenStreetMap for location lookup. Booking.com and Airbnb links are safely unfurled through the `/api/unfurl` route; when a provider blocks automated metadata, Roamwise creates an editable fallback entry.

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

## Agent add-on and local previews

The website provides the editor; the standalone CLI provides a lighter read-only agent preview. The CLI is packaged as `@alexmodrono/roamwise`; this checkout can build a tarball before npm publication.

```bash
npm ci
npm run pack:cli
npx skills add ./skills/roamwise -g
```

Use `-a claude-code`, `-a codex`, or `-a cursor` to target an agent; omit `-g` for a project-local skill. The skill includes the format reference and a minimal example. Until the pinned npm release is published, pass the built tarball by absolute path:

```bash
npm exec --yes --package=/absolute/path/alexmodrono-roamwise-0.1.0.tgz -- roamwise open /absolute/path/trip.yaml --print-url --json
```

After publication, the agent can execute the pinned runtime directly:

```bash
npx --yes --package=@alexmodrono/roamwise@0.1.0 roamwise validate "my-trip.yaml" --json
npx --yes --package=@alexmodrono/roamwise@0.1.0 roamwise open "my-trip.yaml" --print-url --json
```

`open` returns immediately and starts or reuses a background server bound to `127.0.0.1`. It serves explicitly registered files, watches changes (including atomic replacements), and streams updates to the browser. The local preview is read-only. Invalid edits keep the last valid trip visible with diagnostics. Use `--print-url` when the agent opens its own browser or the environment has no default browser. Remote environments need their own port forwarding. `ROAMWISE_STATE_DIR` overrides the default `~/.roamwise` server state directory.

The CLI has no AI key requirement, cloud storage, or runtime dependency on the source checkout. Map tiles and optional remote images still use network services. Flights, listing refreshes, and nearby-place discovery are optional website capabilities; nearby discovery is explicitly activated rather than run during upload.

## Chat-generated trip files

The website accepts uploads, drag-and-drop, or pasted YAML. “Copy prompt for your AI” includes the format in the clipboard text so ChatGPT, Claude chat, and other assistants can produce a valid file without installing anything. If clipboard access is unavailable, the prompt appears in a selectable text area. Files are parsed in the browser; edited trips can be downloaded.

The website also serves the installable CLI at `/downloads/alexmodrono-roamwise-0.1.0.tgz`; `npm run build` builds and packages it before building the site.

Published resources: `/setup.md`, `/format.md`, `/trip.schema.json`, and `/trips/minimal-trip.yaml`. Their canonical sources are the skill reference/example and `packages/core/trip.schema.json`; `npm run dev` and `npm run build` synchronize the copies.

## Architecture and validation

- `packages/core`: YAML parser, JSON Schema, semantic validation, cost calculations, and itinerary construction.
- `components/trip-viewer.tsx`: shared React viewer; `app/page.tsx` mounts the website version.
- `hooks/use-trip-document.ts`: browser persistence or a read-only local event stream.
- `packages/cli`: standalone CLI, restricted local HTTP server, and Vite viewer entry point. `scripts/build-cli.mjs` bundles runtime dependencies and static viewer assets.
- `skills/roamwise`: cross-agent instructions, format reference, and portable example.

Missing prices stay unknown; zero means free. The UI labels sums as known subtotals and notes unpriced selected items. The JSON Schema validator is compiled to ordinary JavaScript at build time so it runs in Cloudflare Workers without dynamic code generation. Validation rejects malformed nested fields, invalid dates, duplicate IDs, broken references, unsafe URLs, oversized files, and YAML aliases. Missing coordinates and site-relative image paths produce warnings. v2 remains a single-destination model with one selected stay and outbound/return flight alternatives.

```bash
npm test              # Builds CLI and tests validation, costs, dates, watching, and installers
npm run typecheck
npm run build         # Website production build
npm run build:cli     # Standalone distributable
```

The first release intentionally leaves local file writes, review handoffs, MCP tools, and multi-city schema changes for later. Website editing/download remains available.

### Custom map theme

`public/maps/orchard.json` is the editable MapLibre style used by all maps. Orchard is an Apple Maps-inspired light theme: pale blue water, green parks, warm building footprints, white local roads, gold highways, and quieter labels. It retains OpenFreeMap vector tiles, sprites, and Noto Sans glyphs. It is an approximation using open data and fonts, not Apple cartography or assets. The style and its upstream license notices are included in the CLI viewer. See `public/maps/README.md` for attribution.

### Lightweight static website

Run `npm run build:static` and serve `dist/static` at your domain root. This distribution requires no application server for visual planning, YAML editing, maps or printing. For optional live enrichment, build with `ROAMWISE_API=same-origin npm run build:static` and proxy `/api/*` to the existing hosted API service. The normal `npm run build` deployment remains fully supported.

See [performance and distribution notes](docs/performance.md) for measurements, asset regeneration and hosting details.

### Skill-first public installation

The preferred release flow is `npx skills add alexmodrono/roamwise --skill roamwise -g`, followed by asking the agent to plan a trip. The GitHub repository is https://github.com/alexmodrono/roamwise. The skill invokes `npx --yes --package=@alexmodrono/roamwise@0.1.0 roamwise …`; users do not need a global CLI install. Publish that npm version before advertising this flow. Update the skill's runtime pin alongside future releases. See [setup instructions](public/setup.md) for local and tarball workflows.

### Public landing and planner

The homepage explains the agent-companion workflow and accepts a YAML upload, drop or paste. Valid documents are saved in the browser before opening `/planner/`; invalid documents leave the existing saved trip intact. The planner retains visual editing, source editing, download and printing. The static distribution emits both `index.html` and `planner/index.html`, so both URLs work on hosts with directory index support. Landing-page map artwork is an illustration; interactive maps load in the actual planner.
