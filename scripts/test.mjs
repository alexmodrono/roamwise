import './compile-trip-schema.mjs';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
await mkdir('.test-build', { recursive: true });
await build({ entryPoints: ['tests/core.test.ts', 'tests/cli.test.ts'], bundle: true, platform: 'node', format: 'esm', outdir: '.test-build', outExtension: { '.js': '.mjs' }, banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } });
const child = spawn(process.execPath, ['--disallow-code-generation-from-strings', '--test', '.test-build/core.test.mjs', '.test-build/cli.test.mjs'], { stdio: 'inherit' });
child.on('exit', code => { process.exitCode = code ?? 1; });
