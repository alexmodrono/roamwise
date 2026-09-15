# Lightweight distribution

The hosted app (`npm run build`) keeps its existing APIs. The additional `npm run build:static` command creates `dist/static`, a client-only website suitable for any static host. Serve that folder at the domain root over HTTP(S); opening index.html with file:// or deploying beneath a URL subpath is not supported. No Node server is needed in production. Maps still request OpenFreeMap tiles, sprites and glyphs over the network.

The static version stores trips in the browser and supports visual editing, YAML validation/import/export, custom maps and PDF printing. By default it disables live fare and listing refresh controls, and listing links become editable entries. To retain enrichment, build with `ROAMWISE_API=same-origin npm run build:static` and route `/api/flights`, `/api/places` and `/api/unfurl` to the existing hosted service through your host's reverse proxy. Do not route these requests to index.html. The regular hosted build requires no extra configuration.

The CLI remains separate (`npm run pack:cli`); static builds include its downloadable package and setup instructions. Agent validation and local file preview do not require the hosted APIs.

## Loading and resource use

- Interactive maps initialize when their container enters the viewport. Once visible they remain active to retain camera position. The MapLibre code, styles, worker and map-data requests are deferred until then.
- Print maps initialize eagerly so offscreen print content is available. A completed snapshot releases its map and WebGL canvas. Save as PDF waits up to 15 seconds for the map and then proceeds even if the network is unavailable.
- Map point data updates only when point properties change. Camera fitting only depends on positions and the destination center, so changing prices or notes does not reset the camera.
- Dialogs and print layout are separate dynamic chunks. The YAML editor and its JetBrains Mono font styles load when opened.
- IBM Plex Sans uses the five existing faces (regular, italic, medium, semibold, bold), all needed by the UI. Both font families use WOFF2 with Unicode ranges so international subsets load only when needed. Regenerate font styles with `node scripts/prepare-fonts.mjs` after font package updates.
- Bundled stay photographs use responsive 480/960 WebP variants with explicit dimensions and asynchronous decoding. Cards load lazily; details and print images eagerly. External photo URLs are preserved. Regenerate bundled variants with `npm run optimize:images` when originals change; originals are the source assets for image optimization.

## Reproduce measurements

Run `npm run build:cli`, then `node scripts/report-bundle.mjs packages/cli/dist/viewer/assets docs/performance-after.json`. The baseline in performance-baseline.json was captured from the existing production CLI viewer before this change. Gzip is measured consistently with Node's gzipSync, not a browser transfer estimate. The static website has a similar viewer but lacks server hydration/runtime code. Deferred chunks are still downloaded when their feature is used; the map library itself has not become smaller.

Use a fresh browser session at a narrow viewport to verify zero map canvases before scrolling to Map and one afterwards. Open Preview & print: once its image appears, its canvas should be removed. These are observable resource-lifecycle checks, not measurements of total process/GPU memory or mobile load time.

For hosting, enable Brotli/gzip and cache hashed `/assets/` files immutably, while revalidating HTML and unversioned map/style/photo resources. Compression and cache headers are host settings; this repository does not claim to configure an arbitrary static host.

## Results (12 September 2026)

| Production CLI viewer asset | Before, gzip | After, gzip | Change |
| --- | ---: | ---: | ---: |
| Initial JavaScript | 155,608 B | 135,617 B | −12.8% |
| Initial CSS | 42,996 B | 33,291 B | −22.6% |

34 bundled original photographs total 3,687,687 B. The 480px variants total 693,142 B (−81.2%); the 960px variants total 1,913,954 B (−48.1%). A browser selects one variant per visible image; the figures are asset totals, not per-page network measurements.

Verified: production hosted and static builds; TypeScript; all 11 core/CLI tests; clean external installation of the packaged CLI, including bundled map style and WOFF2 font serving. Browser checks confirmed settings, YAML font styling, offscreen map deferral, map initialization on scroll, and a captured print map with no remaining snapshot canvas. No numerical total-memory or load-time claim is made.

## Agent-session follow-up (13 September 2026)

The CLI now serves a separate read-only viewer. It retains trip options, stay details/photos, daily and unscheduled activities, YAML download/source, diagnostics and print preview, while leaving editing to the agent. Maps require an explicit click and unmount while hidden; the full website retains its editor and automatic visible-map behavior. Local event streams pause on document visibility changes and refresh the file on reconnect.

The server uses native parent-directory events with a one-second polling fallback (`ROAMWISE_WATCH_MODE=poll` forces the fallback for network filesystems). It watches only connected sessions, discards cached YAML after the last viewer disconnects, and exits after five minutes without viewers. `ROAMWISE_IDLE_MS` can override the delay at startup. A URL cannot restart an exited server: reopen the YAML with the CLI to obtain a new URL. Agent skill guidance now asks agents to write/validate first and reuse one preview.

The server JavaScript fell from 273,603 bytes to approximately 9 KB after isolating the size limit from the parser. Initial CLI viewer JavaScript fell from 488 KB to approximately 385 KB (106 KB gzip in Vite's report), with map/print chunks deferred and no CodeMirror chunk. These are bundle sizes, not resident memory. A single macOS `ps` sample 1.5 seconds after starting isolated old/new servers showed roughly 56 MiB RSS for both (57,728 vs 57,152 KiB); this is not evidence of a meaningful per-process memory improvement. Automatic exit is the material idle-memory improvement.

Lifecycle regression tests cover native events and forced polling, active connections preventing shutdown, atomic replacement, disconnected edits, catch-up on reconnect, automatic shutdown and reopening, alongside the existing validator and CLI tests.
