import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const exec = promisify(execFile);
const archive = resolve('packages/cli/roamwise-cli-0.1.0.tgz');
const temp = await mkdtemp(join(tmpdir(), 'roamwise-package-'));
const runDirectory = await mkdtemp(join(tmpdir(), 'roamwise-npx-'));
const env = { ...process.env, ROAMWISE_STATE_DIR: join(temp, 'state') };
const executable = join(temp, 'node_modules/@roamwise/cli/dist/cli.mjs');
try {
  await exec('npm', ['install', '--prefix', temp, '--ignore-scripts', '--no-audit', '--no-fund', archive]);
  // npm exec is npx's execution backend. Use an isolated cache and no global install.
  const { stdout } = await exec('npm', ['exec', '--yes', `--cache=${join(temp, 'npm-cache')}`, `--package=${archive}`, '--', 'roamwise', 'open', join(temp, 'node_modules/@roamwise/cli/dist/skill/assets/minimal-trip.yaml'), '--print-url', '--json'], { cwd: runDirectory, env });
  const { url } = JSON.parse(stdout);
  const response = await fetch(url); assert.equal(response.status, 200);
  const html = await response.text();
  const cssPath = html.match(/href="([^"]+\.css)"/)[1];
  const cssResponse = await fetch(new URL(cssPath, url)); assert.equal(cssResponse.status, 200);
  const css = await cssResponse.text();
  assert.ok(css.includes('.rounded-3xl'), 'Packaged CSS must include utilities from the shared viewer, even when npm packs from its own cwd');
  assert.ok(css.includes('.grid'), 'Grid layout utilities must be present');
  const scriptPath = html.match(/src="([^"]+\.js)"/)[1];
  assert.equal((await fetch(new URL(scriptPath, url))).status, 200);
  assert.equal((await fetch(new URL('/trips/minimal-trip.yaml', url))).status, 200);
  assert.equal((await fetch(new URL('/format.md', url))).status, 200);
  const mapStyle = await fetch(new URL('/maps/orchard.json', url));
  assert.equal(mapStyle.status, 200);
  assert.equal((await mapStyle.json()).version, 8);
  const fontPaths = [...css.matchAll(/url\(["']?([^\)"']+\.woff2)["']?\)/g)].map(match => match[1]);
  assert.ok(fontPaths.length > 0, 'Self-hosted WOFF2 fonts must be bundled');
  assert.equal((await fetch(new URL(fontPaths[0], new URL(cssPath, url)))).status, 200);

  const { stdout: validation } = await exec(process.execPath, [executable, 'validate', join(temp, 'node_modules/@roamwise/cli/dist/skill/assets/minimal-trip.yaml'), '--json'], { cwd: temp, env });
  assert.equal(JSON.parse(validation).valid, true);
  console.log('Packaged CLI runs through npm exec without global installation and keeps its preview server alive; viewer assets, styles, example, and validator verified.');
} finally {
  await exec(process.execPath, [executable, 'stop'], { env }).catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 150));
  await rm(temp, { recursive: true, force: true });
  await rm(runDirectory, { recursive: true, force: true });
}
