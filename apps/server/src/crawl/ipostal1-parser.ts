import * as cheerio from 'cheerio';

import { normalizeText, parseCityStateZip, parsePriceCents, textWithBreaks } from './parser.js';

// 入口页只用作各州接口请求的 Referer；州按钮由前端 JS 渲染，服务端 HTML 里没有
export const IPOSTAL1_LOCATIONS_URL = 'https://ipostal1.com/choose-digital-mailbox-location.php';
const IPOSTAL1_US_COUNTRY_ID = '223';

// iPostal1 美国各州/地区在其数据库中的 ID（取自入口页 button.region-btn 的 state-id 属性，2026-10）
export const IPOSTAL1_US_STATES: ReadonlyArray<{ stateId: string; code: string; name: string }> = [
  { stateId: '1', code: 'AL', name: 'Alabama' },
  { stateId: '2', code: 'AK', name: 'Alaska' },
  { stateId: '4', code: 'AZ', name: 'Arizona' },
  { stateId: '5', code: 'AR', name: 'Arkansas' },
  { stateId: '12', code: 'CA', name: 'California' },
  { stateId: '13', code: 'CO', name: 'Colorado' },
  { stateId: '14', code: 'CT', name: 'Connecticut' },
  { stateId: '15', code: 'DE', name: 'Delaware' },
  { stateId: '16', code: 'DC', name: 'District of Columbia' },
  { stateId: '18', code: 'FL', name: 'Florida' },
  { stateId: '19', code: 'GA', name: 'Georgia' },
  { stateId: '21', code: 'HI', name: 'Hawaii' },
  { stateId: '22', code: 'ID', name: 'Idaho' },
  { stateId: '23', code: 'IL', name: 'Illinois' },
  { stateId: '24', code: 'IN', name: 'Indiana' },
  { stateId: '25', code: 'IA', name: 'Iowa' },
  { stateId: '26', code: 'KS', name: 'Kansas' },
  { stateId: '27', code: 'KY', name: 'Kentucky' },
  { stateId: '28', code: 'LA', name: 'Louisiana' },
  { stateId: '29', code: 'ME', name: 'Maine' },
  { stateId: '31', code: 'MD', name: 'Maryland' },
  { stateId: '32', code: 'MA', name: 'Massachusetts' },
  { stateId: '33', code: 'MI', name: 'Michigan' },
  { stateId: '34', code: 'MN', name: 'Minnesota' },
  { stateId: '35', code: 'MS', name: 'Mississippi' },
  { stateId: '36', code: 'MO', name: 'Missouri' },
  { stateId: '37', code: 'MT', name: 'Montana' },
  { stateId: '38', code: 'NE', name: 'Nebraska' },
  { stateId: '39', code: 'NV', name: 'Nevada' },
  { stateId: '40', code: 'NH', name: 'New Hampshire' },
  { stateId: '41', code: 'NJ', name: 'New Jersey' },
  { stateId: '42', code: 'NM', name: 'New Mexico' },
  { stateId: '43', code: 'NY', name: 'New York' },
  { stateId: '44', code: 'NC', name: 'North Carolina' },
  { stateId: '45', code: 'ND', name: 'North Dakota' },
  { stateId: '47', code: 'OH', name: 'Ohio' },
  { stateId: '48', code: 'OK', name: 'Oklahoma' },
  { stateId: '49', code: 'OR', name: 'Oregon' },
  { stateId: '51', code: 'PA', name: 'Pennsylvania' },
  { stateId: '52', code: 'PR', name: 'Puerto Rico' },
  { stateId: '53', code: 'RI', name: 'Rhode Island' },
  { stateId: '54', code: 'SC', name: 'South Carolina' },
  { stateId: '55', code: 'SD', name: 'South Dakota' },
  { stateId: '56', code: 'TN', name: 'Tennessee' },
  { stateId: '57', code: 'TX', name: 'Texas' },
  { stateId: '58', code: 'UT', name: 'Utah' },
  { stateId: '59', code: 'VT', name: 'Vermont' },
  { stateId: '61', code: 'VA', name: 'Virginia' },
  { stateId: '62', code: 'WA', name: 'Washington' },
  { stateId: '63', code: 'WV', name: 'West Virginia' },
  { stateId: '64', code: 'WI', name: 'Wisconsin' },
  { stateId: '65', code: 'WY', name: 'Wyoming' },
  { stateId: '186', code: 'GU', name: 'Guam' },
];

export interface Ipostal1State {
  name: string;
  code: string;
  stateId: string;
  url: string;
}

export interface Ipostal1Location {
  storeId: string;
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  priceCents: number;
  detailUrl: string;
}

export interface Ipostal1MailCenters {
  // 接口返回的 num_results，用作该州的地点总数
  count: number | null;
  locations: Ipostal1Location[];
}

export function buildIpostal1StateUrl(countryId: string, stateId: string) {
  return `https://ipostal1.com/locations_ajax.php?action=get_mail_centers&country_id=${encodeURIComponent(countryId)}&state_id=${encodeURIComponent(stateId)}&exactMatch=0`;
}

export function buildIpostal1CheckoutUrl(storeId: string) {
  return `https://ipostal1.com/secure_checkout.php?stID=${encodeURIComponent(storeId)}`;
}

export function listIpostal1States(): Ipostal1State[] {
  return IPOSTAL1_US_STATES.map((state) => ({
    ...state,
    url: buildIpostal1StateUrl(IPOSTAL1_US_COUNTRY_ID, state.stateId),
  }));
}

// 州接口返回 JSON，其中 display 字段是地点卡片的 HTML
export function parseIpostal1MailCenters(body: string, fallbackState: string): Ipostal1MailCenters {
  let payload: { num_results?: unknown; display?: unknown };
  try {
    payload = JSON.parse(body) as { num_results?: unknown; display?: unknown };
  } catch {
    throw new Error(`iPostal1 state endpoint did not return JSON: ${normalizeText(body).slice(0, 120)}`);
  }

  const count = typeof payload.num_results === 'number' && Number.isFinite(payload.num_results)
    ? payload.num_results
    : null;
  const display = typeof payload.display === 'string' ? payload.display : '';
  if (!display) {
    return { count, locations: [] };
  }

  const $ = cheerio.load(display);
  const locations: Ipostal1Location[] = [];
  const seen = new Set<string>();

  $('article.mail-center-card').each((_, element) => {
    const card = $(element);
    const storeId = normalizeText(card.attr('store-id'));
    if (!storeId || seen.has(storeId)) {
      return;
    }

    const tooltipLines = String(card.attr('store-tooltip') || '')
      .split(/\r?\n/)
      .map((line) => normalizeText(line))
      .filter(Boolean);
    const streetElement = card.find('.store-street-address').first();
    const streetAddress = streetElement.length
      ? textWithBreaks($, streetElement)
      : normalizeText(tooltipLines.slice(0, -2).join(' '));
    const cityStateZipText = normalizeText(card.find('.store-city-state-zip').first().text())
      || tooltipLines.find((line) => /,\s*[A-Z]{2}\s+\d{5}/.test(line))
      || '';
    const cityStateZip = parseCityStateZip(cityStateZipText);
    const city = cityStateZip.city;
    const state = (cityStateZip.state || fallbackState).toUpperCase();
    const postalCode = cityStateZip.zip || normalizeText(card.attr('store-postcode'));

    if (!streetAddress || !city || !postalCode) {
      return;
    }

    seen.add(storeId);
    const streetLine1 = streetElement.length ? firstStreetLine(streetElement, streetAddress) : streetAddress;
    const priceText = card.find('.store-plan-desktop b').first().text() || card.find('.store-plan-mobile b').first().text();
    const detailUrl = normalizeText(card.find('a.choose-location-btn').first().attr('href')) || buildIpostal1CheckoutUrl(storeId);

    locations.push({
      storeId,
      // iPostal1 的门店名不公开，沿用 ATMB 的“城市 - 街道”命名
      name: `${city} - ${streetLine1}`,
      streetAddress,
      city,
      state,
      postalCode,
      priceCents: parsePriceCents(priceText),
      detailUrl,
    });
  });

  return { count, locations };
}

// 街道元素里 <br> 之前的部分，例如 "3300 Arctic Blvd<br>Suite 201" → "3300 Arctic Blvd"
function firstStreetLine(element: cheerio.Cheerio<any>, fallback: string) {
  const [first] = (element.html() ?? '').split(/<br\s*\/?>/i);
  const text = normalizeText(cheerio.load(`<div>${first ?? ''}</div>`)('div').text());

  return text || fallback;
}
