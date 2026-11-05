// 用网站的 favicon.svg 生成扩展图标（已提交到 public/icons，网站图标变了再跑）：node scripts/make-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/icons');
mkdirSync(outDir, { recursive: true });

const svg = readFileSync(resolve(root, '../web/public/assets/favicon.svg'));

for (const size of [16, 48, 128]) {
  const png = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
  writeFileSync(resolve(outDir, `icon-${size}.png`), png);
}
console.log(`icons written to ${outDir}`);
