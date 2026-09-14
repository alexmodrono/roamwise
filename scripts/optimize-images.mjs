import sharp from 'sharp';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
const names = (await readdir('public/stays')).filter((name) =>
  /\.(jpg|png)$/i.test(name),
);
await mkdir('public/stays/optimized', { recursive: true });
const manifest = {};
for (const name of names) {
  const stem = name.replace(/\.[^.]+$/, '');
  const variants = [];
  for (const width of [480, 960]) {
    const src = `/stays/optimized/${stem}-${width}.webp`;
    const info = await sharp(`public/stays/${name}`).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toFile(`public${src}`);
    if (!variants.some(variant => variant.width === info.width)) variants.push({ src, width: info.width, height: info.height });
  }
  manifest[`/stays/${name}`] = variants;
}
await writeFile(
  'lib/stay-images.json',
  JSON.stringify(manifest, null, 2) + '\n',
);
