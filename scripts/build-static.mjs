import './sync-trip-resources.mjs';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { resolve } from 'node:path';
import { cp } from 'node:fs/promises';
const root = process.cwd();
await build({
  configFile: false,
  root: resolve('packages/web'),
  publicDir: false,
  plugins: [react()],
  define: {
    __ROAMWISE_STATIC__: JSON.stringify(
      process.env.ROAMWISE_API !== 'same-origin',
    ),
  },
  resolve: { alias: { '@': root } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: resolve('dist/static'), emptyOutDir: true, rolldownOptions: { input: { main: resolve('packages/web/index.html'), planner: resolve('packages/web/planner/index.html') } } },
});
for (const name of [
  'downloads',
  'maps',
  'roamwise.svg',
  'stays',
  'trips',
  'format.md',
  'setup.md',
  'trip.schema.json',
])
  await cp(resolve('public', name), resolve('dist/static', name), {
    recursive: true,
  });
