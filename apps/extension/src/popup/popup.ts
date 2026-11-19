import type { AddressSource } from '@atmb/shared';

import { clearHidden, readHidden } from '../shared/hidden.js';
import { t, type MessageKey } from '../shared/i18n.js';
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
  setStatus(t(reply.done || reply.started || reply.pending ? 'popupStatusEnabled' : 'popupStatusEnabledPrompt'));
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

// popup.html 里带 data-i18n 的元素不写死文字，按浏览器界面语言填
function localize() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.title = t('appName');
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n as MessageKey);
  }
  // 中文界面打开 USPS 的中文版查询页
  byId<HTMLAnchorElement>('nav-usps').href = t('popupLinkUspsUrl');
}

async function init() {
  localize();
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
      setStatus(t('popupStatusSaved'));
    });
  }

  byId('clear-cache').addEventListener('click', async () => {
    await send({ type: 'clearCache' });
    await refreshStats();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.reload(tab.id);
    }
    setStatus(t('popupStatusCacheCleared'));
  });

  const refreshHidden = async () => {
    byId('hidden-count').textContent = t('popupHiddenCountValue', Object.keys(await readHidden()).length);
  };
  byId('clear-hidden').addEventListener('click', async () => {
    await clearHidden();
    await refreshHidden();
    setStatus(t('popupStatusHiddenCleared'));
  });

  await refreshHidden();
  await refreshStats();
}

void init();
