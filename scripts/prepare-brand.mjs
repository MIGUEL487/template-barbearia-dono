// Export the supplied mark for the web; no network or generation during builds.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
const dir = 'public/brand/auto-stilo';
await mkdir(dir, { recursive: true });
const icons = {};
for (const tone of ['light', 'dark']) {
  const input = `assets/brand/auto-stilo-on-${tone}.png`;
  await sharp(input).resize({ width: 384, withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(`${dir}/logo-on-${tone}.png`);
  for (const size of [16, 32, 48, 128]) {
    const buffer = await sharp(input).resize(size, size, { fit: 'contain', background: '#00000000' }).png({ compressionLevel: 9 }).toBuffer();
    await writeFile(`${dir}/favicon-${tone}-${size}.png`, buffer);
    icons[`${tone}-${size}`] = buffer;
  }
}
const image = tone => `<image class="on-${tone}" width="64" height="64" href="data:image/png;base64,${icons[`${tone}-128`].toString('base64')}"/>`;
await writeFile('public/favicon-dono-branco.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${image('dark')}</svg>\n`);
// PNG-compressed ICO entries, supported by current browsers and Windows.
const sizes = [16, 32, 48];
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (const [i, size] of sizes.entries()) {
  const entry = 6 + i * 16, buffer = icons[`dark-${size}`];
  header[entry] = size; header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(buffer.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += buffer.length;
}
await writeFile('public/favicon-dono-branco.ico', Buffer.concat([header, ...sizes.map(s => icons[`dark-${s}`])]));
await writeFile('public/favicon.ico', Buffer.concat([header, ...sizes.map(s => icons[`dark-${s}`])]));
await sharp('assets/brand/auto-stilo-on-light.png').resize(180, 180, { fit: 'contain', background: '#fff' }).flatten({background:'#fff'}).png().toFile('public/apple-touch-icon.png');
console.log('Light/dark logos, adaptive favicon, ICO fallbacks and Apple icon exported.');
