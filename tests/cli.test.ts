import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const exec = promisify(execFile);
const cli = resolve('packages/cli/dist/cli.mjs');
const minimal = await readFile('skills/roamwise/assets/minimal-trip.yaml', 'utf8');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

void test('CLI opens isolated sessions, follows atomic edits, rejects unauthorized reads, and stops cleanly', { timeout: 25000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'roamwise-test-'));
  const env = { ...process.env, ROAMWISE_STATE_DIR: join(dir, 'state') };
  const run = async (...args: string[]) => JSON.parse((await exec(process.execPath, [cli, ...args, '--json'], { env })).stdout);
  const file = join(dir, 'my trip.yaml');
  const abort = new AbortController();
  try {
    await writeFile(file, minimal);
    const opened = await run('open', file, '--print-url');
    const reused = await run('open', file, '--print-url');
    assert.equal(opened.url, reused.url);
    const url = new URL(opened.url);
    assert.equal(url.hostname, '127.0.0.1');
    assert.equal((await fetch(url.origin)).status, 200);
    assert.equal((await fetch(`${url.origin}/api/status`)).status, 403);
    assert.equal((await fetch(`${url.origin}/api/open`, { method: 'POST', body: JSON.stringify({ path: file }), headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(`${url.origin}/api/trip/events?session=wrong`)).status, 404);
    assert.equal((await fetch(`${url.origin}/api/trip/events?path=${encodeURIComponent(file)}`)).status, 404);
    const second = join(dir, 'second.yaml'); await writeFile(second, minimal.replace('A weekend', 'Another weekend'));
    const other = await run('open', second, '--print-url'); assert.notEqual(other.url, opened.url);
    const session = new URLSearchParams(url.hash.slice(1)).get('session');
    const response = await fetch(`${url.origin}/api/trip/events?session=${session}`, { signal: abort.signal });
    assert.equal(response.headers.get('content-type'), 'text/event-stream');
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    async function nextTrip() {
      for (;;) {
        const end = buffered.indexOf('\n\n');
        if (end >= 0) {
          const block = buffered.slice(0, end); buffered = buffered.slice(end + 2);
          const data = block.split('\n').find(line => line.startsWith('data: '));
          if (data) return JSON.parse(data.slice(6));
        } else { const chunk = await reader.read(); if (chunk.done) throw new Error('Stream ended early'); buffered += decoder.decode(chunk.value, { stream: true }); }
      }
    }
    assert.equal((await nextTrip()).source, minimal);
    const revised = minimal.replace('A weekend', 'A revised weekend');
    await writeFile(`${file}.tmp`, revised); await rename(`${file}.tmp`, file);
    assert.equal((await nextTrip()).source, revised);
    await writeFile(file, 'schema: ['); assert.equal((await nextTrip()).source, 'schema: [');
    await rm(file); assert.match((await nextTrip()).error, /ENOENT/);
    await writeFile(file, minimal); assert.equal((await nextTrip()).source, minimal);
    assert.equal(await readFile(file, 'utf8'), minimal);
    abort.abort();
    await run('stop');
    await sleep(200);
    assert.equal((await run('status')).running, false);
  } finally { abort.abort(); await run('stop').catch(() => {}); await sleep(150); await rm(dir, { recursive: true, force: true }); }
});
void test('CLI validation reports valid, invalid and missing files', { timeout: 15000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'roamwise-validation-'));
  try {
    const file = join(dir, 'trip.yaml'); await writeFile(file, minimal);
    const result = await exec(process.execPath, [cli, 'validate', file, '--json']); assert.equal(JSON.parse(result.stdout).valid, true);
    await writeFile(file, minimal + '\nunknown: true');
    await assert.rejects(exec(process.execPath, [cli, 'validate', file, '--json']), error => { const result = error as Error & { code: number; stdout: string }; return result.code === 1 && JSON.parse(result.stdout).errors[0].path === 'unknown'; });
    await assert.rejects(exec(process.execPath, [cli, 'validate', join(dir, 'missing.yaml'), '--json']), error => (error as Error & { code: number }).code === 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

for (const mode of ['native', 'poll']) void test(`Idle lifecycle and disconnected edits (${mode})`, { timeout: 20000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'roamwise-idle-'));
  const env = { ...process.env, ROAMWISE_STATE_DIR: join(dir, 'state'), ROAMWISE_IDLE_MS: '1800', ROAMWISE_WATCH_MODE: mode };
  const run = async (...args: string[]) => JSON.parse((await exec(process.execPath, [cli, ...args, '--json'], { env })).stdout);
  const file = join(dir, 'trip.yaml');
  let abort = new AbortController();
  try {
    await writeFile(file, minimal);
    const opened = await run('open', file, '--print-url');
    const url = new URL(opened.url);
    const endpoint = `${url.origin}/api/trip/events?session=${new URLSearchParams(url.hash.slice(1)).get('session')}`;
    const connect = async () => {
      const response = await fetch(endpoint, { signal: abort.signal });
      const reader = response.body!.getReader();
      const first = await reader.read();
      return { reader, text: new TextDecoder().decode(first.value) };
    };
    let stream = await connect();
    assert.ok(stream.text.includes('event: trip'));
    await sleep(2100);
    assert.equal((await run('status')).running, true, 'Connected preview prevents idle shutdown');
    await writeFile(`${file}.tmp`, minimal.replace('A weekend', 'Live change'));
    await rename(`${file}.tmp`, file);
    assert.match(new TextDecoder().decode((await stream.reader.read()).value), /Live change/);
    abort.abort();
    await sleep(100);
    await writeFile(file, minimal.replace('A weekend', 'While disconnected'));
    abort = new AbortController();
    stream = await connect();
    assert.match(stream.text, /While disconnected/, 'Reconnect reads current file');
    abort.abort();
    await sleep(2300);
    assert.equal((await run('status')).running, false, 'Idle server exits');
    const reopened = await run('open', file, '--print-url');
    assert.ok(reopened.url);
    await sleep(2300);
    assert.equal((await run('status')).running, false, 'Never-viewed session also expires');
  } finally { abort.abort(); await run('stop').catch(() => {}); await sleep(150); await rm(dir, { recursive: true, force: true }); }
});
