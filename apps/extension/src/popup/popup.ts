import type { AddressSource } from '@atmb/shared';

import { clearHidden, readHidden } from '../shared/hidden.js';
import { platformForUrl, referralUrlFor } from '../shared/referral.js';
import { readSettings, writeSettings } from '../shared/settings.js';
import type { CacheStats, LookupMessage, ReferralReply, Settings } from '../shared/types.js';

const SETTING_KEYS: Array<keyof Settings> = ['enableAnytimemailbox', 'enableIpostal1', 'defaultExpanded', 'showFilterBar', 'showUnrecorded', 'autoCloseVerifyTab'];
const PLATFORM_OF_SETTING: Partial<Record<keyof Settings, AddressSource>> = {
  enableAnytimemailbox: 'anytimemailbox',
  enableIpostal1: 'ipostal1',
};

function send<T>(message: LookupMessage) {
  return new Promise<T>((resolve) => chrome.runtime.sendMessage(message, (reply: T) => resolve(reply)));
}

function byId<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

function setStatus(text: string) {
  byId('status').textContent = text;
  byId('status').className = 'foot ok';
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
  const api = byId<HTMLAnchorElement>('api-base');
  api.textContent = stats.apiBase.replace(/^https?:\/\//, '');
  api.title = stats.apiBase;
  api.href = `${stats.apiBase}/`;
}

// 打开平台开关的瞬间就走一次推荐链接：当前标签页在该平台就原地跳并跳回，否则另开标签页
async function referOnEnable(platform: AddressSource) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const onPlatform = tab?.id !== undefined && platformForUrl(tab.url) === platform;
  const reply = await send<ReferralReply>(
    onPlatform
      ? { type: 'referral', platform, tabId: tab.id, returnUrl: tab.url ?? null }
      : { type: 'referral', platform, newTab: true },
  );
  setStatus(reply.done || reply.started || reply.pending ? '已开启。' : '已开启，打开平台页面时如未显示数据，请点击页面上的「点击启用」。');
}

// 平台快捷入口走推荐链接：归因过期时交给后台开新标签页并记录归因，没过期就直接打开推荐链接
function bindPlatformLink(platform: AddressSource) {
  const link = byId<HTMLAnchorElement>(`nav-${platform}`);
  link.href = referralUrlFor(platform);
  link.addEventListener('click', async (event) => {
    event.preventDefault();
    const reply = await send<ReferralReply>({ type: 'referral', platform, newTab: true });
    if (!reply.started) {
      await chrome.tabs.create({ url: referralUrlFor(platform) });
    }
  });
}

async function init() {
  byId('version').textContent = `v${chrome.runtime.getManifest().version}`;
  bindPlatformLink('anytimemailbox');
  bindPlatformLink('ipostal1');
  const settings = await readSettings();
  for (const key of SETTING_KEYS) {
    const input = byId<HTMLInputElement>(key);
    input.checked = settings[key];
    input.addEventListener('change', async () => {
      await writeSettings({ [key]: input.checked });
      const platform = PLATFORM_OF_SETTING[key];
      if (platform && input.checked) {
        await referOnEnable(platform);
        return;
      }
      setStatus('已保存，页面上的数据条会立即生效。');
    });
  }

  byId('clear-cache').addEventListener('click', async () => {
    await send({ type: 'clearCache' });
    await refreshStats();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.reload(tab.id);
    }
    setStatus('缓存已清除，当前页面已刷新。');
  });

  const refreshHidden = async () => {
    byId('hidden-count').textContent = `${Object.keys(await readHidden()).length} 个`;
  };
  byId('clear-hidden').addEventListener('click', async () => {
    await clearHidden();
    await refreshHidden();
    setStatus('隐藏记录已清空，列表会恢复显示这些地址。');
  });

  await refreshHidden();
  await refreshStats();
}

void init();
