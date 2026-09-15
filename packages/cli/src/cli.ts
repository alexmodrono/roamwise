import { readFile, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { validateTrip, MAX_TRIP_BYTES } from '../../core/trip-schema';

const dist = dirname(fileURLToPath(import.meta.url));
const stateDir = process.env.ROAMWISE_STATE_DIR || join(homedir(), '.roamwise');
const stateFile = join(stateDir, 'server.json');
const args = process.argv.slice(2);
const command = args[0] || 'help';
const jsonOutput = args.includes('--json');
type ServerState = { pid: number; url: string; token: string; version: string };
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function output(value: unknown, human: string) { process.stdout.write((jsonOutput ? JSON.stringify(value) : human) + '\n'); }
async function request(state: ServerState, path: string, body?: unknown) {
  const url = new URL(state.url);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') throw new Error('Invalid local server state');
  const response = await fetch(`${state.url}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(3000) });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : response.statusText);
  return result;
}
async function running(): Promise<ServerState | undefined> {
  try { const state = JSON.parse(await readFile(stateFile, 'utf8')) as ServerState; await request(state, '/api/status'); return state; } catch { return undefined; }
}
async function start(): Promise<ServerState> {
  const existing = await running(); if (existing) return existing;
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const lock = join(stateDir, 'start.lock');
  let locked = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { await mkdir(lock); locked = true; break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const started = await running(); if (started) return started;
      // Only reclaim an abandoned startup lock, never kill an unrelated PID.
      try { if (Date.now() - (await stat(lock)).mtimeMs > 30000) await rm(lock, { recursive: true, force: true }); } catch { /* Lock changed */ }
      await pause(150);
    }
  }
  if (!locked) throw new Error('Another Roamwise server is starting. Try again shortly.');
  try {
    const existing = await running(); if (existing) return existing;
    const child = spawn(process.execPath, [join(dist, 'server.mjs')], { detached: true, stdio: 'ignore', env: { ...process.env, ROAMWISE_SERVER_STATE: stateFile, ROAMWISE_SERVER_TOKEN: randomBytes(32).toString('hex') } });
    let spawnError: Error | undefined;
    child.on('error', error => { spawnError = error; }); child.unref();
    for (let attempt = 0; attempt < 60; attempt++) { if (spawnError) throw spawnError; await pause(100); const state = await running(); if (state) return state; }
    child.kill();
    throw new Error('Local server did not start. Rebuild or reinstall the CLI.');
  } finally { await rm(lock, { recursive: true, force: true }); }
}
async function openBrowser(url: string) {
  const executable = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32' : 'xdg-open';
  const browserArgs = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, browserArgs, { stdio: 'ignore' });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error('Browser could not be opened')));
  });
}
function valueAfter(flag: string, fallback: string) { const index = args.indexOf(flag); return index < 0 ? fallback : args[index + 1] ?? ''; }
async function main() {
  if (command === '--version' || command === 'version') return output({ version: '0.1.0' }, '0.1.0');
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`Roamwise — portable trip previews\n\n  roamwise open <file.yaml> [--print-url | --no-open] [--json]\n  roamwise validate <file.yaml> [--json]\n  roamwise start [--json]\n  roamwise status [--json]\n  roamwise stop [--json]\n  roamwise help agent\n\nOpen returns immediately; a shared server keeps visible previews live and stops after five idle minutes.\nNo YAML files are uploaded or modified. Map tiles and optional remote images use the network.`);
    if (args[1] === 'agent') console.log(await readFile(join(dist, 'skill', 'SKILL.md'), 'utf8'));
    return;
  }
  if (command === 'validate') {
    if (!args[1] || args[1].startsWith('--')) throw new Error('Usage: roamwise validate <file.yaml> [--json]');
    if ((await stat(resolve(args[1]))).size > MAX_TRIP_BYTES) throw new Error('Trip files must be smaller than 2 MiB');
    const result = validateTrip(await readFile(resolve(args[1]), 'utf8'));
    const report = { valid: result.valid, errors: result.errors, warnings: result.warnings };
    output(report, [result.valid ? 'Valid trip' : 'Invalid trip', ...result.errors.map(issue => `ERROR ${issue.path}: ${issue.message}`), ...result.warnings.map(issue => `NOTE ${issue.path}: ${issue.message}`)].join('\n'));
    process.exitCode = result.valid ? 0 : 1; return;
  }
  if (command === 'status') { const state = await running(); output({ running: Boolean(state), ...(state ? { url: state.url, pid: state.pid, version: state.version } : {}) }, state ? `Running at ${state.url}` : 'Not running'); return; }
  if (command === 'stop') { const state = await running(); if (state) await request(state, '/api/stop', {}); output({ stopped: Boolean(state) }, state ? 'Stopped Roamwise' : 'Not running'); return; }
  if (command === 'start') { const state = await start(); output({ running: true, url: state.url, pid: state.pid }, `Running at ${state.url}\nUse roamwise open <file.yaml> to open a trip.`); return; }
  if (command === 'open') {
    if (!args[1] || args[1].startsWith('--')) throw new Error('Usage: roamwise open <file.yaml>');
    const path = resolve(args[1]);
    // Fail before starting a daemon for a missing or oversized file.
    const details = await stat(path);
    if (!details.isFile() || !/\.ya?ml$/i.test(path)) throw new Error('Choose a regular .yaml or .yml file');
    if (details.size > MAX_TRIP_BYTES) throw new Error('Trip files must be smaller than 2 MiB');
    const state = await start(); const result = await request(state, '/api/open', { path });
    if (!args.includes('--print-url') && !args.includes('--no-open')) try { await openBrowser(String(result.url)); } catch { process.stderr.write('Could not launch a browser. Open the printed URL manually.\n'); }
    output(result, String(result.url)); return;
  }
  throw new Error(`Unknown command: ${command}. Run roamwise help.`);
}
main().catch(error => { output({ error: error instanceof Error ? error.message : String(error) }, error instanceof Error ? error.message : String(error)); process.exitCode = 2; });
