// 一次性生成扩展图标（已提交到 public/icons，改样式时再跑）：node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/icons');
mkdirSync(outDir, { recursive: true });

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="8" y="8" width="112" height="112" rx="26" fill="#057f93"/>
  <path d="M64 28c-15.5 0-28 12.3-28 27.5C36 76 64 102 64 102s28-26 28-46.5C92 40.3 79.5 28 64 28z" fill="#ffffff"/>
  <circle cx="64" cy="55" r="11" fill="#057f93"/>
</svg>`;

for (const size of [16, 48, 128]) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  writeFileSync(resolve(outDir, `icon-${size}.png`), png);
}
console.log(`icons written to ${outDir}`);
