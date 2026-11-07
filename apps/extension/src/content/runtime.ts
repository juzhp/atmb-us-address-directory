import type { AddressSource } from '@atmb/shared';

import { ADDRESS_TAIL_PATTERN, extractAddressText, extractZip } from '../shared/extract.js';
import { isHiddenByFilters, renderFilterBar, type FilterBar } from '../shared/filter-bar.js';
import { hiddenKey, onHiddenChanged, readHidden, writeHidden, type HiddenMap } from '../shared/hidden.js';
import { isPlatformEnabled, isReferralFresh } from '../shared/referral.js';
import { onReferralChanged, onSettingsChanged, readFilters, readReferral, readSettings, writeFilters } from '../shared/settings.js';
import { HOST_ATTR, renderCard, type CardView, type PageAddress } from '../shared/ui.js';
import { buildVerifyAddress, type VerifyAddress, type VerifyProvider, type VerifyResult } from '../shared/verify.js';
import { DEFAULT_FILTERS, type ExtensionLookupItem, type ExtensionLookupResult, type FilterState, type LookupReply, type ReferralReply, type Settings, type VerifyPush, type VerifyStartReply } from '../shared/types.js';

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
  // 平台自己的开通入口；点击时归因过期就先走一次推荐链接再放行
  ctaSelector: string;
  // 入口点击后要去的 URL；返回 null 时留在当前页
  ctaTarget(element: HTMLElement): string | null;
}

const CARD_ATTR = 'data-usaddr';
const HIDDEN_ATTR = 'data-usaddr-hidden';
const PROMPT_ATTR = 'data-usaddr-prompt';
const MIN_CARDS_FOR_FILTER_BAR = 5;
const GENERIC_SKIP_SELECTOR = 'header, footer, nav, script, style, noscript, [data-usaddr], [data-usaddr-host], [data-usaddr-filter], [data-usaddr-prompt]';

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

function sendMessage<T>(message: unknown) {
  return new Promise<T>((resolve) => {
    chrome.runtime.sendMessage(message, (reply: T | undefined) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message } as T);
        return;
      }
      resolve(reply ?? ({ error: 'empty reply' } as T));
    });
  });
}

function markCardResult(card: HTMLElement, result: Pick<ExtensionLookupResult, 'address' | 'blacklist'>) {
  card.dataset.usaddrRecorded = result.address ? '1' : '0';
  card.dataset.usaddrBlacklisted = result.blacklist.length > 0 ? '1' : '0';
  card.dataset.usaddrRdi = result.address?.rdi ?? '';
  card.dataset.usaddrCmra = result.address?.cmra ?? '';
  card.dataset.usaddrUsps = result.address?.uspsCmra ?? '';
  card.dataset.usaddrC1 = result.address?.c1Precheck ?? '';
}

// 推荐链接没走通时页面上只留这一枚标签，点击重试
function renderEnablePrompt(onClick: () => void) {
  const host = document.createElement('div');
  host.setAttribute(PROMPT_ATTR, '1');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
:host { all: initial; display: block; margin: 8px 0; font: 12px/1.4 "Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans SC",Arial,sans-serif; }
button { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px 0 8px; border-radius: 12px; border: 1px solid #d3e3ec; background: #f5f9fc; color: #526980; font: inherit; font-weight: 600; cursor: pointer; }
button:hover { border-color: #68b7c6; color: #006a7b; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #b4b2a9; }
`;
  const button = document.createElement('button');
  button.type = 'button';
  const dot = document.createElement('span');
  dot.className = 'dot';
  button.append(dot, document.createTextNode('点击启用 usaddres 数据'));
  button.addEventListener('click', onClick);
  shadow.append(style, button);
  return host;
}

export async function startContentScript(adapter: SiteAdapter) {
  let settings: Settings = await readSettings();
  let filtersUrl = location.href;
  let filters: FilterState = await readFilters(filtersUrl);
  let referralAt: string | undefined = (await readReferral())[adapter.platform];
  let hiddenMap: HiddenMap = await readHidden();
  const views = new Map<HTMLElement, CardView>();
  let filterBar: FilterBar | null = null;
  let prompt: HTMLElement | null = null;
  let active = false;
  let gating = false;
  let refCounter = 0;
  let running = false;
  let dirty = false;
  let warned = false;

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
        void writeFilters(filtersUrl, next);
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

  // 实时查询：交给后台去开 Smarty / USPS 页面，结果通过消息推回来；等不到就超时
  const pendingVerify = new Map<string, (result: VerifyResult) => void>();
  const VERIFY_TIMEOUT_MS: Record<VerifyProvider, number> = { smarty: 45_000, usps: 5 * 60_000 };

  function verify(provider: VerifyProvider, address: VerifyAddress) {
    return new Promise<VerifyResult>((resolve) => {
      refCounter += 1;
      const requestId = `${Date.now()}-${refCounter}`;
      const settle = (result: VerifyResult) => {
        if (!pendingVerify.delete(requestId)) return;
        clearTimeout(timer);
        resolve(result);
      };
      const timer = setTimeout(
        () => settle({ ok: false, error: provider === 'smarty' ? 'Smarty 查询超时，请稍后重试' : '等待超时，请重新点击 USPS 实时查询' }),
        VERIFY_TIMEOUT_MS[provider],
      );
      pendingVerify.set(requestId, settle);
      void sendMessage<VerifyStartReply>({ type: 'verify', provider, address, requestId }).then((reply) => {
        if (!reply.started) settle({ ok: false, error: reply.error ?? '无法打开查询页面' });
      });
    });
  }

  chrome.runtime.onMessage.addListener((message: VerifyPush) => {
    if (message?.type === 'verifyResult') {
      pendingVerify.get(message.requestId)?.(message.result);
    }
  });

  // 本地隐藏 / 取消隐藏一张卡片：记到本机存储，再按当前筛选刷新显示
  function toggleHidden(card: HTMLElement, key: string, label: string) {
    const next = card.dataset.usaddrLocalHidden !== '1';
    if (next) {
      hiddenMap[key] = { label, at: new Date().toISOString() };
    } else {
      delete hiddenMap[key];
    }
    card.dataset.usaddrLocalHidden = next ? '1' : '0';
    views.get(card)?.setLocalHidden(next);
    void writeHidden(hiddenMap);
    applyFilters();
  }

  async function process() {
    if (!active) return;
    // 单页应用里链接变了（没有整页刷新）也要把筛选重置
    if (location.href !== filtersUrl) {
      filtersUrl = location.href;
      filters = { ...DEFAULT_FILTERS };
      filterBar?.host.remove();
      filterBar = null;
    }
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

    const reply = await sendMessage<LookupReply>({ type: 'lookup', items });
    if (reply.error || !reply.results) {
      for (const entry of scanned) entry.card.removeAttribute(CARD_ATTR);
      if (!warned) {
        warned = true;
        console.warn('[usaddres] 查询失败：', reply.error);
      }
      return;
    }
    if (!active) return;

    const byRef = new Map(reply.results.map((result) => [result.ref, result]));
    scanned.forEach((entry, index) => {
      const result = byRef.get(items[index]!.ref);
      if (!result || !entry.card.isConnected) return;
      markCardResult(entry.card, result);
      // 隐藏只在列表页提供：详情页、选套餐页只有一个地址，藏起来没有意义
      const hideKey = adapter.listContainer() ? hiddenKey(entry.item) : null;
      const hideLabel = entry.pageAddress.street
        ? `${entry.pageAddress.street}, ${entry.pageAddress.city ?? ''} ${entry.pageAddress.state ?? ''} ${entry.pageAddress.postalCode ?? ''}`.trim()
        : (entry.pageAddress.text ?? '');
      const localHidden = Boolean(hideKey && hiddenMap[hideKey]);
      entry.card.dataset.usaddrLocalHidden = localHidden ? '1' : '0';
      if (hideKey) entry.card.dataset.usaddrHideKey = hideKey;
      const view = renderCard({
        platform: adapter.platform,
        result,
        pageAddress: entry.pageAddress,
        expanded: settings.defaultExpanded,
        localHidden,
        onToggleHidden: hideKey ? () => toggleHidden(entry.card, hideKey, hideLabel) : undefined,
        // 以页面上看到的地址为准去查；页面拆不出结构化字段时用本站记录的地址
        verify: (provider) =>
          verify(
            provider,
            buildVerifyAddress(
              entry.pageAddress.street || !result.address
                ? entry.pageAddress
                : { street: result.address.streetAddress, city: result.address.city, state: result.address.state, postalCode: result.address.postalCode },
            ),
          ),
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
      if (target.closest?.(`[${HOST_ATTR}], [data-usaddr-filter], [${PROMPT_ATTR}]`)) return false;
      return [...record.addedNodes].some(
        (node) => node instanceof HTMLElement && !node.hasAttribute(HOST_ATTR) && !node.hasAttribute('data-usaddr-filter') && !node.hasAttribute(PROMPT_ATTR),
      );
    });
    if (relevant) void schedule();
  });

  function removePrompt() {
    prompt?.remove();
    prompt = null;
  }

  function showPrompt() {
    if (prompt?.isConnected) return;
    removePrompt();
    prompt = renderEnablePrompt(() => void gate());
    const container = adapter.listContainer();
    if (container?.parentElement) {
      container.parentElement.insertBefore(prompt, container);
    } else {
      document.body.prepend(prompt);
    }
  }

  function activate() {
    removePrompt();
    if (active) return;
    active = true;
    ensurePageStyle();
    observer.observe(document.body, { childList: true, subtree: true });
    void schedule();
  }

  // 关闭平台开关：把注入的东西全部撤掉，再开时能重新注入
  function teardown() {
    if (!active) {
      removePrompt();
      return;
    }
    active = false;
    observer.disconnect();
    for (const [card, view] of views) {
      view.host.remove();
      card.removeAttribute(CARD_ATTR);
      card.removeAttribute(HIDDEN_ATTR);
    }
    views.clear();
    filterBar?.host.remove();
    filterBar = null;
    removePrompt();
  }

  async function requestReferral(returnUrl: string) {
    return sendMessage<ReferralReply>({ type: 'referral', platform: adapter.platform, returnUrl });
  }

  // 功能与推荐链接绑定：平台开关开着且 30 天内走过推荐链接才注入；否则先去走一次，页面会离开再回来
  async function gate() {
    if (gating) return;
    gating = true;
    try {
      if (!isPlatformEnabled(settings, adapter.platform)) {
        teardown();
        return;
      }
      if (isReferralFresh(referralAt)) {
        activate();
        return;
      }
      const reply = await requestReferral(location.href);
      if (reply.done) {
        activate();
      } else if (!reply.started && !reply.pending) {
        showPrompt();
      }
      // started / pending：等 onReferralChanged 触发后再进来
    } finally {
      gating = false;
    }
  }

  // 点平台自己的开通按钮时兜底：归因过期就先走推荐链接，再去原本要去的地方
  document.addEventListener(
    'click',
    (event) => {
      if (!active || isReferralFresh(referralAt)) return;
      const target = event.target as Element | null;
      const cta = target?.closest?.<HTMLElement>(adapter.ctaSelector);
      if (!cta) return;
      event.preventDefault();
      event.stopPropagation();
      void requestReferral(adapter.ctaTarget(cta) ?? location.href);
    },
    true,
  );

  onSettingsChanged((next) => {
    settings = next;
    void gate();
    if (!active) return;
    for (const view of views.values()) view.setExpanded(settings.defaultExpanded);
    applyUnrecordedVisibility();
    syncFilterBar();
    applyFilters();
  });

  // 弹窗清空隐藏记录、或别的标签页改了隐藏状态时，同步到当前页面
  onHiddenChanged((map) => {
    hiddenMap = map;
    for (const [card, view] of views) {
      const key = card.dataset.usaddrHideKey;
      if (!key) continue;
      const hidden = Boolean(map[key]);
      card.dataset.usaddrLocalHidden = hidden ? '1' : '0';
      view.setLocalHidden(hidden);
    }
    if (active) applyFilters();
  });

  onReferralChanged((record) => {
    referralAt = record[adapter.platform];
    if (!active) void gate();
  });

  await gate();
}
