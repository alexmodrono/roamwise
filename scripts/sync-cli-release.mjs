import { copyFile, mkdir, readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const { version } = JSON.parse(await readFile(new URL('packages/cli/package.json', root), 'utf8'));
await mkdir(new URL('public/downloads/', root), { recursive: true });
await copyFile(new URL(`packages/cli/roamwise-cli-${version}.tgz`, root), new URL(`public/downloads/roamwise-cli-${version}.tgz`, root));
