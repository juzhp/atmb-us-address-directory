import { atmbSlugFromHref, collapseWhitespace, parseAddressLines, splitHtmlLines, stripMailboxPlaceholder } from '../shared/extract.js';
import { extractOnclickUrl } from '../shared/referral.js';
import { scanGenericAddressText, startContentScript, type ScannedCard, type SiteAdapter } from './runtime.js';

const PLATFORM = 'anytimemailbox' as const;

// 州列表页 /l/usa/{state}：每个 .theme-location-item 一张卡
function scanStateList(): ScannedCard[] {
  return [...document.querySelectorAll<HTMLElement>('.theme-location-item')].flatMap((card) => {
    const addr = card.querySelector<HTMLElement>('.t-addr');
    if (!addr) return [];
    const parsed = parseAddressLines(splitHtmlLines(addr.innerHTML));
    const slug = atmbSlugFromHref(card.querySelector('a[href*="/s/"]')?.getAttribute('href'));
    const text = collapseWhitespace(addr.textContent ?? '');
    return [{
      card,
      anchor: addr,
      insert: 'after' as const,
      item: {
        platform: PLATFORM,
        sourceId: slug ?? undefined,
        street: parsed?.street,
        city: parsed?.city,
        state: parsed?.state,
        postalCode: parsed?.postalCode,
        text: parsed ? undefined : text,
      },
      pageAddress: parsed ?? { text },
    }];
  });
}

// 详情页 /s/{slug}：地址框 .t-sec1 .t-addr，街道行带 "#MAILBOX" 占位
function scanDetail(): ScannedCard[] {
  const addr = document.querySelector<HTMLElement>('.t-sec1 .t-addr') ?? document.querySelector<HTMLElement>('.t-addr');
  if (!addr) return [];
  const lines = [...addr.querySelectorAll<HTMLElement>('.t-text > div')].map((row) => {
    const clone = row.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.t-placeholder').forEach((placeholder) => placeholder.remove());
    return stripMailboxPlaceholder(clone.textContent ?? '');
  });
  const parsed = parseAddressLines(lines);
  const text = lines.join(' ');
  return [{
    card: addr,
    anchor: addr,
    insert: 'after',
    item: {
      platform: PLATFORM,
      sourceId: atmbSlugFromHref(location.pathname) ?? undefined,
      street: parsed?.street,
      city: parsed?.city,
      state: parsed?.state,
      postalCode: parsed?.postalCode,
      text: parsed ? undefined : text,
    },
    pageAddress: parsed ?? { text },
  }];
}

const adapter: SiteAdapter = {
  platform: PLATFORM,
  scan() {
    const path = location.pathname;
    if (path.startsWith('/l/usa/')) return scanStateList();
    if (path.startsWith('/s/')) return scanDetail();
    // 城市落地页等 WordPress 页面只有一行地址文本
    return scanGenericAddressText(PLATFORM);
  },
  listContainer() {
    return location.pathname.startsWith('/l/usa/') ? document.querySelector<HTMLElement>('.left-plans') : null;
  },
  // 列表页 Select Plan、详情页 Select（onclick 跳 signup）、城市页直接指向 signup 的按钮
  ctaSelector: 'a.gt-plan, #myear, a[href*="signup.anytimemailbox.com"]',
  ctaTarget(element) {
    if (element instanceof HTMLAnchorElement && element.href) return element.href;
    return extractOnclickUrl(element.getAttribute('onclick'));
  },
};

void startContentScript(adapter);
