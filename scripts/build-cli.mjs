import './compile-trip-schema.mjs';
import { build as bundle } from 'esbuild';
import { build as buildViewer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cp, mkdir, chmod, rm } from 'node:fs/promises';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// npm pack runs prepack from packages/cli; keep Tailwind's source discovery at the repository root.
process.chdir(root);
const dist = resolve(root, 'packages/cli/dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await bundle({ entryPoints: [resolve(root, 'packages/cli/src/cli.ts'), resolve(root, 'packages/cli/src/server.ts')], outdir: dist, outExtension: { '.js': '.mjs' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', banner: { js: "#!/usr/bin/env node\nimport { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" } });
await buildViewer({ configFile: false, root: resolve(root, 'packages/cli/viewer'), publicDir: false, plugins: [react()], resolve: { alias: { '@': root } }, css: { postcss: { plugins: [tailwindcss()] } }, build: { outDir: resolve(dist, 'viewer'), emptyOutDir: true } });
await mkdir(resolve(dist, 'viewer/trips'), { recursive: true });
await cp(resolve(root, 'skills/roamwise/assets/minimal-trip.yaml'), resolve(dist, 'viewer/trips/minimal-trip.yaml'));
await cp(resolve(root, 'skills/roamwise/references/format.md'), resolve(dist, 'viewer/format.md'));
await cp(resolve(root, 'packages/core/trip.schema.json'), resolve(dist, 'viewer/trip.schema.json'));
await cp(resolve(root, 'public/setup.md'), resolve(dist, 'viewer/setup.md'));
await cp(resolve(root, 'public/maps'), resolve(dist, 'viewer/maps'), { recursive: true });
await cp(resolve(root, 'skills/roamwise'), resolve(dist, 'skill'), { recursive: true });
await cp(resolve(root, 'LICENSE'), resolve(root, 'packages/cli/LICENSE'));
await chmod(resolve(dist, 'cli.mjs'), 0o755);

await cp(resolve(root, 'public/roamwise.svg'), resolve(dist, 'viewer/roamwise.svg'));

await cp(resolve(root, 'public/trips/seville.trip.yaml'), resolve(dist, 'viewer/trips/seville.trip.yaml'));
