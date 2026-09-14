import { createServer, type ServerResponse } from 'node:http';
import {
  readFile,
  realpath,
  stat,
  writeFile,
  rename,
  mkdir,
  rm,
} from 'node:fs/promises';
import { watch, watchFile, unwatchFile } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { basename, resolve, sep, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_TRIP_BYTES } from '../../core/limits';

const stateFile = process.env.ROAMWISE_SERVER_STATE!;
const secret = process.env.ROAMWISE_SERVER_TOKEN!;
const viewerRoot = resolve(dirname(fileURLToPath(import.meta.url)), 'viewer');
type Session = {
  path: string;
  clients: Set<ServerResponse>;
  snapshot: string;
  stopWatching?: () => void;
};
const sessions = new Map<string, Session>();
const configuredIdle = Number(process.env.ROAMWISE_IDLE_MS);
const idleMs =
  Number.isFinite(configuredIdle) && configuredIdle > 0
    ? Math.min(configuredIdle, 2147483647)
    : 300000;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
function updateIdle() {
  clearTimeout(idleTimer);
  if (![...sessions.values()].some((session) => session.clients.size))
    idleTimer = setTimeout(() => void shutdown(), idleMs);
}
function startWatching(session: Session) {
  if (session.stopWatching) return;
  let stopped = false,
    running = false,
    pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watcher: ReturnType<typeof watch> | undefined;
  const refresh = async () => {
    if (stopped) return;
    if (running) {
      pending = true;
      return;
    }
    running = true;
    do {
      pending = false;
      const next = await snapshot(session.path);
      if (!stopped && next !== session.snapshot) {
        session.snapshot = next;
        for (const client of session.clients)
          client.write(`event: trip\ndata: ${next}\n\n`);
      }
    } while (pending && !stopped);
    running = false;
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void refresh(), 40);
  };
  const fallback = () => {
    if (stopped) return;
    watcher?.close();
    watcher = undefined;
    watchFile(session.path, { interval: 1000 }, schedule);
  };
  try {
    if (process.env.ROAMWISE_WATCH_MODE === 'poll') fallback();
    else {
      // Watch the directory so atomic replacements, deletion and recreation remain visible.
      watcher = watch(dirname(session.path), (_, name) => {
        if (!name || name.toString() === basename(session.path)) schedule();
      });
      watcher.on('error', fallback);
    }
  } catch {
    fallback();
  }
  session.stopWatching = () => {
    stopped = true;
    clearTimeout(timer);
    watcher?.close();
    unwatchFile(session.path, schedule);
    session.stopWatching = undefined;
  };
}
const paths = new Map<string, string>();
const token = () => randomBytes(24).toString('hex');
const json = (res: ServerResponse, status: number, value: unknown) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(value));
};

async function snapshot(path: string) {
  try {
    if ((await stat(path)).size > MAX_TRIP_BYTES)
      throw new Error('Trip files must be smaller than 2 MiB');
    const source = await readFile(path, 'utf8');
    if (Buffer.byteLength(source) > MAX_TRIP_BYTES)
      throw new Error('Trip files must be smaller than 2 MiB');
    return JSON.stringify({ fileName: basename(path), source });
  } catch (error) {
    return JSON.stringify({
      fileName: basename(path),
      error: error instanceof Error ? error.message : 'File unavailable',
    });
  }
}
async function register(path: string) {
  const canonical = await realpath(path);
  if (!/\.ya?ml$/i.test(canonical))
    throw new Error('Choose a .yaml or .yml file');
  const details = await stat(canonical);
  if (!details.isFile()) throw new Error('Choose a regular YAML file');
  if (details.size > MAX_TRIP_BYTES)
    throw new Error('Trip files must be smaller than 2 MiB');
  const existing = paths.get(canonical);
  if (existing) {
    updateIdle();
    return existing;
  }
  if (sessions.size >= 100)
    throw new Error(
      'Too many open files. Stop Roamwise and reopen the files you need.',
    );
  const id = token();
  const session = {
    path: canonical,
    clients: new Set<ServerResponse>(),
    snapshot: '',
  };
  sessions.set(id, session);
  paths.set(canonical, id);
  updateIdle();
  return id;
}
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.yaml': 'application/yaml',
  '.md': 'text/plain; charset=utf-8',
};
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  const address = server.address();
  if (!address || typeof address === 'string')
    return json(res, 503, { error: 'Starting' });
  const origin = `http://127.0.0.1:${address.port}`;
  if (
    req.headers.host !== `127.0.0.1:${address.port}` ||
    (req.headers.origin && req.headers.origin !== origin)
  )
    return json(res, 403, { error: 'Invalid origin' });
  const url = new URL(req.url ?? '/', origin);
  try {
    if (
      url.pathname === '/api/status' ||
      url.pathname === '/api/open' ||
      url.pathname === '/api/stop'
    ) {
      if (req.headers.authorization !== `Bearer ${secret}`)
        return json(res, 403, { error: 'Unauthorized' });
      if (url.pathname === '/api/status' && req.method === 'GET')
        return json(res, 200, {
          running: true,
          pid: process.pid,
          url: origin,
          version: '0.1.0',
        });
      if (url.pathname === '/api/stop' && req.method === 'POST') {
        json(res, 200, { stopped: true });
        setTimeout(() => void shutdown(), 50);
        return;
      }
      if (url.pathname === '/api/open' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 16384)
            return json(res, 413, { error: 'Request too large' });
        }
        const data = JSON.parse(body);
        if (typeof data.path !== 'string')
          return json(res, 400, { error: 'path is required' });
        const id = await register(data.path);
        return json(res, 200, {
          path: sessions.get(id)!.path,
          url: `${origin}/#session=${id}`,
        });
      }
      return json(res, 405, { error: 'Method not allowed' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD')
      return json(res, 405, { error: 'Read-only preview' });
    if (url.pathname === '/api/trip/events') {
      const session = sessions.get(url.searchParams.get('session') ?? '');
      if (!session)
        return json(res, 404, {
          error: 'Unknown session. Open the file using roamwise open.',
        });
      if (req.method !== 'GET') return json(res, 405, { error: 'Use GET' });
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
      });
      session.clients.add(res);
      updateIdle();
      startWatching(session);
      res.on('close', () => {
        session.clients.delete(res);
        if (!session.clients.size) {
          session.stopWatching?.();
          session.snapshot = '';
        }
        updateIdle();
      });
      // Refresh on connect to avoid stale data after a disconnected browser returns.
      const currentSnapshot = await snapshot(session.path);
      if (res.destroyed) return;
      session.snapshot = currentSnapshot;
      res.write(`event: trip\ndata: ${session.snapshot}\n\n`);
      const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 15000);
      res.on('close', () => clearInterval(heartbeat));
      return;
    }
    if (url.pathname.startsWith('/api/'))
      return json(res, 404, {
        error: 'Optional enrichment is available on the hosted website',
      });
    const candidate = resolve(
      viewerRoot,
      `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`,
    );
    if (!candidate.startsWith(viewerRoot + sep))
      return json(res, 403, { error: 'Forbidden' });
    const actual = await realpath(candidate);
    if (!actual.startsWith(viewerRoot + sep))
      return json(res, 403, { error: 'Forbidden' });
    const data = await readFile(actual);
    res.writeHead(200, {
      'Content-Type':
        contentTypes[extname(actual)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) {
    json(res, 400, {
      error: error instanceof Error ? error.message : 'Request failed',
    });
  }
});
async function shutdown() {
  for (const session of sessions.values()) {
    session.stopWatching?.();
    for (const client of session.clients) client.end();
  }
  clearTimeout(idleTimer);
  server.close();
  server.closeAllConnections();
  try {
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    if (state.token === secret) await rm(stateFile, { force: true });
  } catch {
    /* Already removed */
  }
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
server.listen(0, '127.0.0.1', async () => {
  const address = server.address();
  if (!address || typeof address === 'string') return;
  await mkdir(dirname(stateFile), { recursive: true, mode: 0o700 });
  const temp = `${stateFile}.${process.pid}.tmp`;
  await writeFile(
    temp,
    JSON.stringify({
      pid: process.pid,
      url: `http://127.0.0.1:${address.port}`,
      token: secret,
      version: '0.1.0',
    }),
    { mode: 0o600 },
  );
  await rename(temp, stateFile);
  updateIdle();
});
