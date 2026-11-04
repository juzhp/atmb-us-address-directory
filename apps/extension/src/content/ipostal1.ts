import { collapseWhitespace, extractAddressText, extractZip, parseAddressLines, parseCityLine, splitHtmlLines } from '../shared/extract.js';
import { scanGenericAddressText, startContentScript, type ScannedCard, type SiteAdapter } from './runtime.js';

const PLATFORM = 'ipostal1' as const;

// 地址选择页等：locations_ajax 渲染出的 article.mail-center-card
function scanMailCenterCards(): ScannedCard[] {
  return [...document.querySelectorAll<HTMLElement>('article.mail-center-card[store-id]')].flatMap((card) => {
    const streetEl = card.querySelector<HTMLElement>('.store-street-address');
    const cityEl = card.querySelector<HTMLElement>('.store-city-state-zip');
    const street = streetEl ? splitHtmlLines(streetEl.innerHTML).join(' ') : '';
    const cityLine = cityEl ? parseCityLine(cityEl.textContent ?? '') : null;
    const tooltipParsed = parseAddressLines((card.getAttribute('store-tooltip') ?? '').split('\n'));
    const parsed = street && cityLine ? { street, ...cityLine } : tooltipParsed;
    // 插在地址段落最后一行（United States）之后，不把地址拆开；图片在同一行的另一列，不受影响
    const anchor = card.querySelector<HTMLElement>('.stores-country') ?? cityEl ?? card.querySelector<HTMLElement>('.store-address') ?? card;
    const postalCode = parsed?.postalCode ?? card.getAttribute('store-postcode') ?? undefined;
    return [{
      card,
      anchor,
      insert: anchor === card ? ('append' as const) : ('after' as const),
      item: {
        platform: PLATFORM,
        sourceId: card.getAttribute('store-id') ?? undefined,
        street: parsed?.street,
        city: parsed?.city,
        state: parsed?.state,
        postalCode,
        text: parsed ? undefined : collapseWhitespace(card.getAttribute('store-tooltip') ?? ''),
      },
      pageAddress: parsed ?? { postalCode, text: collapseWhitespace(card.getAttribute('store-tooltip') ?? '') },
    }];
  });
}

// 选套餐页 select_plan.php：「Your Mailbox Location」下一行地址文本
function scanSelectPlan(): ScannedCard[] {
  return [...document.querySelectorAll<HTMLElement>('.selectPlansStyle-2')].flatMap((block) => {
    const raw = collapseWhitespace((block.textContent ?? '').replace(/Your Mailbox Location|Change/g, ' '));
    const text = extractAddressText(raw);
    if (!text) return [];
    return [{
      card: block,
      anchor: block,
      insert: 'append' as const,
      item: { platform: PLATFORM, text, postalCode: extractZip(text) },
      pageAddress: { text, postalCode: extractZip(text) },
    }];
  });
}

const adapter: SiteAdapter = {
  platform: PLATFORM,
  scan() {
    if (document.querySelector('article.mail-center-card')) return scanMailCenterCards();
    const selectPlan = scanSelectPlan();
    if (selectPlan.length > 0) return selectPlan;
    // 列表容器存在但还没出卡（正在加载）时不要跑通用扫描
    if (document.querySelector('#mail-center-listings')) return [];
    return scanGenericAddressText(PLATFORM);
  },
  listContainer() {
    return document.querySelector<HTMLElement>('#mail-center-listings');
  },
};

void startContentScript(adapter);
