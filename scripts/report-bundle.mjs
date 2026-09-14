import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const dir = process.argv[2] ?? 'packages/cli/dist/viewer/assets';
const rows = [];
for (const file of await readdir(dir)) {
  if (!/\.(js|css)$/.test(file)) continue;
  const data = await readFile(`${dir}/${file}`);
  rows.push({ file, bytes: data.length, gzip: gzipSync(data).length });
}
console.table(rows);
if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(rows, null, 2) + '\n');
const names = (await readdir('public/stays')).filter(name => /\.(jpg|png)$/i.test(name));
let original=0, small=0, large=0;
for (const name of names) {
  original += (await stat(`public/stays/${name}`)).size;
  const stem=name.replace(/\.[^.]+$/,'');
  small += (await stat(`public/stays/optimized/${stem}-480.webp`)).size;
  large += (await stat(`public/stays/optimized/${stem}-960.webp`)).size;
}
console.log(JSON.stringify({ photos: names.length, original, webp480:small, webp960:large }));
