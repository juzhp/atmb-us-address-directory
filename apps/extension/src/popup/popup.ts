import { readSettings, writeSettings } from '../shared/settings.js';
import type { CacheStats, LookupMessage, Settings } from '../shared/types.js';

const SETTING_KEYS: Array<keyof Settings> = ['defaultExpanded', 'showFilterBar', 'showUnrecorded'];

function send<T>(message: LookupMessage) {
  return new Promise<T>((resolve) => chrome.runtime.sendMessage(message, (reply: T) => resolve(reply)));
}

function byId<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

async function refreshStats() {
  const stats = await send<CacheStats>({ type: 'cacheStats' });
  byId('last-lookup').textContent = formatTime(stats.lastLookupAt);
  byId('cache-entries').textContent = String(stats.entries);
  const api = byId('api-base');
  api.textContent = stats.apiBase.replace(/^https?:\/\//, '');
  api.title = stats.apiBase;
}

async function init() {
  byId('version').textContent = `v${chrome.runtime.getManifest().version}`;
  const settings = await readSettings();
  for (const key of SETTING_KEYS) {
    const input = byId<HTMLInputElement>(key);
    input.checked = settings[key];
    input.addEventListener('change', () => {
      void writeSettings({ [key]: input.checked });
      byId('status').textContent = '已保存，页面上的数据条会立即生效。';
      byId('status').className = 'foot ok';
    });
  }

  byId('clear-cache').addEventListener('click', async () => {
    await send({ type: 'clearCache' });
    await refreshStats();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.reload(tab.id);
    }
    byId('status').textContent = '缓存已清除，当前页面已刷新。';
    byId('status').className = 'foot ok';
  });

  await refreshStats();
}

void init();
