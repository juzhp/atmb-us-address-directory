import type { AddressSource } from '@atmb/shared';

import { ADDRESS_TAIL_PATTERN, extractAddressText, extractZip } from '../shared/extract.js';
import { isHiddenByFilters, renderFilterBar, type FilterBar } from '../shared/filter-bar.js';
import { onSettingsChanged, readFilters, readSettings, writeFilters } from '../shared/settings.js';
import { HOST_ATTR, renderCard, type CardView, type PageAddress } from '../shared/ui.js';
import type { ExtensionLookupItem, ExtensionLookupResult, FilterState, LookupReply, Settings } from '../shared/types.js';

export interface ScannedCard {
  // 页面上代表一个地址的元素；筛选时整块隐藏，并在上面打标记
  card: HTMLElement;
  // 数据条插在 anchor 之后（after）或 anchor 内部末尾（append）
  anchor: HTMLElement;
  insert: 'after' | 'append';
  item: Omit<ExtensionLookupItem, 'ref'>;
  pageAddress: PageAddress;
}

export interface SiteAdapter {
  platform: AddressSource;
  // 返回页面上所有尚未处理的地址块
  scan(): ScannedCard[];
  // 列表容器：有的话筛选栏插在它前面
  listContainer(): HTMLElement | null;
}

const CARD_ATTR = 'data-usaddr';
const HIDDEN_ATTR = 'data-usaddr-hidden';
const MIN_CARDS_FOR_FILTER_BAR = 5;
const GENERIC_SKIP_SELECTOR = 'header, footer, nav, script, style, noscript, [data-usaddr], [data-usaddr-host], [data-usaddr-filter]';

export function isProcessed(element: Element) {
  return element.hasAttribute(CARD_ATTR);
}

// 没有已知卡片结构的页面：找出文本里带 "…, ST 12345" 的最内层元素
export function scanGenericAddressText(platform: AddressSource): ScannedCard[] {
  const candidates = [...document.querySelectorAll<HTMLElement>('p, li, span, div, td, address, h1, h2, h3, h4')].filter((element) => {
    if (element.closest(GENERIC_SKIP_SELECTOR)) return false;
    const text = element.textContent ?? '';
    return text.length <= 200 && ADDRESS_TAIL_PATTERN.test(text);
  });
  const innermost = candidates.filter((element) => !candidates.some((other) => other !== element && element.contains(other)));

  return innermost.flatMap((element) => {
    const text = extractAddressText(element.textContent ?? '');
    if (!text) return [];
    return [{
      card: element,
      anchor: element,
      insert: 'after' as const,
      item: { platform, text, postalCode: extractZip(text) },
      pageAddress: { text, postalCode: extractZip(text) },
    }];
  });
}

function ensurePageStyle() {
  if (document.querySelector('style[data-usaddr-style]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-usaddr-style', '1');
  style.textContent = `[${HIDDEN_ATTR}="1"] { display: none !important; }`;
  document.documentElement.append(style);
}

function sendLookup(items: ExtensionLookupItem[]) {
  return new Promise<LookupReply>((resolve) => {
    chrome.runtime.sendMessage({ type: 'lookup', items }, (reply: LookupReply | undefined) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message });
        return;
      }
      resolve(reply ?? { error: 'empty reply' });
    });
  });
}

function markCardResult(card: HTMLElement, result: Pick<ExtensionLookupResult, 'address' | 'blacklist'>) {
  card.dataset.usaddrRecorded = result.address ? '1' : '0';
  card.dataset.usaddrBlacklisted = result.blacklist.length > 0 ? '1' : '0';
  card.dataset.usaddrRdi = result.address?.rdi ?? '';
  card.dataset.usaddrUsps = result.address?.uspsCmra ?? '';
}

export async function startContentScript(adapter: SiteAdapter) {
  let settings: Settings = await readSettings();
  let filters: FilterState = await readFilters();
  const views = new Map<HTMLElement, CardView>();
  let filterBar: FilterBar | null = null;
  let refCounter = 0;
  let running = false;
  let dirty = false;
  let warned = false;

  ensurePageStyle();

  function applyFilters() {
    let shown = 0;
    let total = 0;
    for (const card of views.keys()) {
      if (!card.isConnected) {
        views.delete(card);
        continue;
      }
      total += 1;
      const hidden = isHiddenByFilters(card, filters);
      if (hidden) {
        card.setAttribute(HIDDEN_ATTR, '1');
      } else {
        card.removeAttribute(HIDDEN_ATTR);
        shown += 1;
      }
    }
    filterBar?.setCount(shown, total);
  }

  function syncFilterBar() {
    const container = adapter.listContainer();
    const wanted = settings.showFilterBar && container && views.size >= MIN_CARDS_FOR_FILTER_BAR;
    if (!wanted) {
      filterBar?.host.remove();
      filterBar = null;
      return;
    }
    if (!filterBar) {
      filterBar = renderFilterBar(filters, (next) => {
        filters = next;
        void writeFilters(next);
        applyFilters();
      });
    }
    if (!filterBar.host.isConnected && container.parentElement) {
      container.parentElement.insertBefore(filterBar.host, container);
    }
  }

  function applyUnrecordedVisibility() {
    for (const view of views.values()) {
      if (view.state === 'unrecorded') {
        view.host.style.display = settings.showUnrecorded ? '' : 'none';
      }
    }
  }

  async function process() {
    const scanned = adapter.scan().filter((entry) => !isProcessed(entry.card));
    if (scanned.length === 0) {
      syncFilterBar();
      applyFilters();
      return;
    }

    const items: ExtensionLookupItem[] = scanned.map((entry) => {
      entry.card.setAttribute(CARD_ATTR, '1');
      refCounter += 1;
      return { ref: String(refCounter), ...entry.item };
    });

    const reply = await sendLookup(items);
    if (reply.error || !reply.results) {
      for (const entry of scanned) entry.card.removeAttribute(CARD_ATTR);
      if (!warned) {
        warned = true;
        console.warn('[usaddres] 查询失败：', reply.error);
      }
      return;
    }

    const byRef = new Map(reply.results.map((result) => [result.ref, result]));
    scanned.forEach((entry, index) => {
      const result = byRef.get(items[index]!.ref);
      if (!result || !entry.card.isConnected) return;
      markCardResult(entry.card, result);
      const view = renderCard({
        platform: adapter.platform,
        result,
        pageAddress: entry.pageAddress,
        pageUrl: location.href,
        expanded: settings.defaultExpanded,
      });
      if (entry.insert === 'after') {
        entry.anchor.insertAdjacentElement('afterend', view.host);
      } else {
        entry.anchor.append(view.host);
      }
      views.set(entry.card, view);
    });

    applyUnrecordedVisibility();
    syncFilterBar();
    applyFilters();
  }

  // MutationObserver 回调本身就是按任务批量触发的，直接跑 process；运行中再来的变更标脏，跑完后补一轮。
  // 不用 setTimeout / requestAnimationFrame：标签页在后台时它们会被节流甚至暂停。
  async function schedule() {
    if (running) {
      dirty = true;
      return;
    }
    running = true;
    try {
      do {
        dirty = false;
        await process();
      } while (dirty);
    } finally {
      running = false;
    }
  }

  const observer = new MutationObserver((records) => {
    const relevant = records.some((record) => {
      const target = record.target as Element;
      if (target.closest?.(`[${HOST_ATTR}], [data-usaddr-filter]`)) return false;
      return [...record.addedNodes].some((node) => node instanceof HTMLElement && !node.hasAttribute(HOST_ATTR) && !node.hasAttribute('data-usaddr-filter'));
    });
    if (relevant) void schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  onSettingsChanged((next) => {
    settings = next;
    for (const view of views.values()) view.setExpanded(settings.defaultExpanded);
    applyUnrecordedVisibility();
    syncFilterBar();
    applyFilters();
  });

  await schedule();
}
