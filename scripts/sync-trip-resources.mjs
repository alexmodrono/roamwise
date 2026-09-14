import './compile-trip-schema.mjs';
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
await mkdir(new URL('public/trips/', root), { recursive: true });
for (const [from, to] of [
  ['packages/core/trip.schema.json', 'public/trip.schema.json'],
  ['skills/roamwise/references/format.md', 'public/format.md'],
  ['skills/roamwise/assets/minimal-trip.yaml', 'public/trips/minimal-trip.yaml'],
]) await cp(fileURLToPath(new URL(from, root)), fileURLToPath(new URL(to, root)));
