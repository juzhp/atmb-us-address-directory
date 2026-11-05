// 构建扩展：esbuild 打包 4 个入口到 dist/，再复制 manifest / popup / 图标。
// `--dev` 时 API 指向本地 3001，并给 manifest 追加 localhost 的 host permission。
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const apiBase = dev ? 'http://localhost:3001' : 'https://usaddres.com';
const dist = resolve(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  absWorkingDir: root,
  entryPoints: {
    background: 'src/background.ts',
    'content/atmb': 'src/content/atmb.ts',
    'content/ipostal1': 'src/content/ipostal1.ts',
    'content/smarty': 'src/content/smarty.ts',
    'content/usps': 'src/content/usps.ts',
    'popup/popup': 'src/popup/popup.ts',
  },
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  outdir: dist,
  minify: !dev,
  define: {
    __API_BASE__: JSON.stringify(apiBase),
    __DEV__: JSON.stringify(dev),
  },
  logLevel: 'info',
});

const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
if (dev) {
  manifest.name += ' (dev)';
  manifest.host_permissions.push(`${apiBase}/*`);
}
writeFileSync(resolve(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
cpSync(resolve(root, 'src/popup/popup.html'), resolve(dist, 'popup/popup.html'));
cpSync(resolve(root, 'public/icons'), resolve(dist, 'icons'), { recursive: true });

console.log(`extension built → ${dist} (API ${apiBase})`);
