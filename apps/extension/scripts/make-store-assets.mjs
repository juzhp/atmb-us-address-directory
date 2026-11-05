// 生成商店用的宣传图和 Edge 商店图标（已提交到 store/assets，改文案或图标后再跑）：node scripts/make-store-assets.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'store/assets');
mkdirSync(outDir, { recursive: true });

const iconSvg = readFileSync(resolve(root, '../web/public/assets/favicon.svg'));
const FONT = "'Microsoft YaHei','PingFang SC','Noto Sans SC',Arial,sans-serif";

// 商店要求宣传图和截图是不带透明通道的 24 位 PNG；合成之后再去一次 alpha
async function flat(buffer) {
  return sharp(buffer).removeAlpha().png().toBuffer();
}

async function iconPng(size) {
  return sharp(iconSvg, { density: 384 }).resize(size, size).png().toBuffer();
}

function badge(x, y, text, fill, color, fontSize, padX) {
  const units = [...text].reduce((total, char) => total + (char.charCodeAt(0) > 0x2e7f ? 1.05 : 0.62), 0);
  const width = Math.round(units * fontSize + padX * 2);
  const height = Math.round(fontSize * 1.9);
  return {
    width,
    svg: `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${Math.round(height / 4)}" fill="${fill}"/>
<text x="${x + width / 2}" y="${y + height / 2}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="${fontSize}" font-weight="700" fill="${color}">${text}</text>`,
  };
}

// 宣传图：品牌渐变底 + 图标 + 名称 + 一句话 + 一排示例徽章；不带透明通道
async function promo({ width, height, iconSize, iconX, iconY, title, titleSize, tagline, taglineSize, textX, titleY, badgeY, badgeSize, file }) {
  const badges = [
    ['RDI Residential', '#e4f6ed', '#116a49'],
    ['CMRA No', '#e4f6ed', '#116a49'],
    ['USPS CMRA N', '#e4f6ed', '#116a49'],
    ['黑名单', '#d93636', '#ffffff'],
  ];
  let x = textX;
  const badgeSvg = badges
    .map(([text, fill, color]) => {
      const item = badge(x, badgeY, text, fill, color, badgeSize, Math.round(badgeSize * 0.8));
      x += item.width + Math.round(badgeSize * 0.6);
      return item.svg;
    })
    .join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a8792"/><stop offset="1" stop-color="#071a3f"/></linearGradient></defs>
<rect width="${width}" height="${height}" fill="url(#bg)"/>
<text x="${textX}" y="${titleY}" font-family="${FONT}" font-size="${titleSize}" font-weight="700" fill="#ffffff">${title}</text>
<text x="${textX}" y="${titleY + Math.round(titleSize * 0.5) + taglineSize}" font-family="${FONT}" font-size="${taglineSize}" fill="#d7eef2">${tagline}</text>
${badgeSvg}
</svg>`;

  const image = await sharp(Buffer.from(svg))
    .composite([{ input: await iconPng(iconSize), left: iconX, top: iconY }])
    .flatten({ background: '#071a3f' })
    .png()
    .toBuffer();
  writeFileSync(resolve(outDir, file), await flat(image));
}

await promo({
  width: 440, height: 280, iconSize: 72, iconX: 28, iconY: 30,
  title: '美国住宅地址筛选', titleSize: 34, tagline: 'ATMB / iPostal1 · RDI / CMRA / 黑名单 · usaddres', taglineSize: 15,
  textX: 28, titleY: 150, badgeY: 212, badgeSize: 12, file: 'promo-small-440x280.png',
});
await promo({
  width: 1400, height: 560, iconSize: 150, iconX: 90, iconY: 80,
  title: 'ATMB / iPostal1 美国住宅地址筛选', titleSize: 62, tagline: '选地址时直接看 RDI、CMRA、USPS CMRA、C1 预审与黑名单 · usaddres', taglineSize: 30,
  textX: 90, titleY: 330, badgeY: 440, badgeSize: 26, file: 'promo-marquee-1400x560.png',
});

// Edge Add-ons 要 300×300 的商店图标；Chrome 用包里的 128×128
writeFileSync(resolve(outDir, 'store-logo-300x300.png'), await sharp(iconSvg, { density: 600 }).resize(300, 300).flatten({ background: '#ffffff' }).png().toBuffer());
writeFileSync(resolve(outDir, 'store-icon-128x128.png'), await iconPng(128));
// 弹窗展示图：把弹窗截图（store/raw/popup.png，2 倍图）摆到 1280×800 的品牌底上，配一段说明
const popupRaw = resolve(root, 'store/raw/popup.png');
if (existsSync(popupRaw)) {
  const shotDir = resolve(root, 'store/screenshots');
  mkdirSync(shotDir, { recursive: true });
  const popupHeight = 720;
  const popup = await sharp(popupRaw).resize({ height: popupHeight }).png().toBuffer();
  const popupWidth = (await sharp(popup).metadata()).width;
  const left = 1280 - popupWidth - 150;
  const top = 40;
  const lines = ['按平台开启，默认关闭', '筛选栏、未收录提示、展开方式随时切换', '一键清理缓存与本地隐藏记录', '常用查询入口放在手边'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a8792"/><stop offset="1" stop-color="#071a3f"/></linearGradient></defs>
<rect width="1280" height="800" fill="url(#bg)"/>
<text x="100" y="250" font-family="${FONT}" font-size="52" font-weight="700" fill="#ffffff">一个弹窗，全部设置</text>
${lines.map((line, index) => `<circle cx="112" cy="${332 + index * 62}" r="7" fill="#7fd6c2"/><text x="136" y="${342 + index * 62}" font-family="${FONT}" font-size="28" fill="#d7eef2">${line}</text>`).join('\n')}
<rect x="${left - 10}" y="${top - 10}" width="${popupWidth + 20}" height="${popupHeight + 20}" rx="18" fill="#ffffff"/>
</svg>`;
  const image = await sharp(Buffer.from(svg)).composite([{ input: popup, left, top }]).flatten({ background: '#071a3f' }).png().toBuffer();
  writeFileSync(resolve(shotDir, '04-popup.png'), await flat(image));
}

console.log(`store assets written to ${outDir}`);
