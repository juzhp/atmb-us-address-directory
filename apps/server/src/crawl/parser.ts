import * as cheerio from 'cheerio';

export interface ParsedState {
  name: string;
  url: string;
  count: number | null;
}

export interface ParsedLocation {
  name: string;
  address: string;
  price: string;
  url: string;
}

export interface ParsedLocationDetail {
  myearUrl: string | null;
  detailAddress: string;
  country: string;
  state: string;
  city: string;
  address: string;
  zip: string;
}

export interface ParsedMailboxRange {
  mailboxNumbers: number[];
  mailboxMin: number | null;
  mailboxMax: number | null;
}

export const DEFAULT_CRAWL_HEADERS = Object.freeze({
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
});

export function parseStateList(html: string, baseUrl: string): ParsedState[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const states: ParsedState[] = [];
  const locationListLinks = $('.loc-list-container a[href]');
  const hasLocationList = locationListLinks.length > 0;
  const links = hasLocationList ? locationListLinks : $('a[href]');

  links.each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;

    const stateUrl = new URL(href, baseUrl);
    if ((!hasLocationList && !isStateUrl(stateUrl)) || seen.has(stateUrl.pathname)) return;

    const item = $(element).clone();
    let count: number | null = getCountInsideLink($, item);
    if (count === null) {
      count = getCountBesideLink($, element);
    }

    let name = normalizeText(item.text());
    if (count === null) {
      const trailingCount = name.match(/^(.*?)\s+(\d+)$/);
      if (trailingCount) {
        name = normalizeText(trailingCount[1] ?? '');
        count = Number(trailingCount[2] ?? 0);
      }
    }

    if (!name) return;

    seen.add(stateUrl.pathname);
    states.push({
      name,
      url: stateUrl.toString(),
      count,
    });
  });

  return states;
}

export function parseLocationList(html: string, baseUrl: string): ParsedLocation[] {
  const $ = cheerio.load(html);
  const locations: ParsedLocation[] = [];

  $('.theme-location-item').each((_, element) => {
    const item = $(element);
    const name = normalizeText(item.find('.t-title').first().text());
    const address = textWithBreaks($, item.find('.t-addr').first());
    const price = normalizeText(item.find('.t-price b').first().text());
    const href = item.find('a.gt-plan[href], a[href]').first().attr('href');

    if (!name || !href) return;

    locations.push({
      name,
      address,
      price,
      url: new URL(href, baseUrl).toString(),
    });
  });

  return locations;
}

export function parseLocationDetail(html: string, baseUrl: string): ParsedLocationDetail {
  const $ = cheerio.load(html);
  const myearElement = $('#myear').first();
  const addressElements = $('.t-addr .t-text > div').toArray();
  const rows = addressElements
    .map((element) => ({
      text: normalizeText($(element).text()),
      ownText: ownText($, element),
    }))
    .filter((row) => row.text && !/^your name$/i.test(row.text));
  const cityStateZipIndex = rows.findIndex((row) => Boolean(parseCityStateZip(row.text).zip));
  const cityStateZip = cityStateZipIndex >= 0 ? rows[cityStateZipIndex]?.text ?? '' : '';
  const country = cityStateZipIndex >= 0
    ? normalizeText(rows[cityStateZipIndex + 1]?.text ?? '') || 'United States'
    : '';
  const addressRows = dropLeadingAddressLabel(cityStateZipIndex >= 0 ? rows.slice(0, cityStateZipIndex) : rows);
  const address = normalizeText(
    addressRows
      .map((row) => cleanMailboxUnitText(row.ownText || row.text))
      .filter(Boolean)
      .join(' '),
  );
  const parsedLocation = parseCityStateZip(cityStateZip);
  const detailAddress = normalizeText(
    [
      address,
      cityStateZip,
      country,
    ]
      .filter(Boolean)
      .join(' '),
  );

  return {
    myearUrl: (myearElement.length ? getElementLink($, myearElement, baseUrl) : null)
      ?? findSignupUrl($, html, baseUrl),
    detailAddress,
    country,
    state: parsedLocation.state,
    city: parsedLocation.city,
    address,
    zip: parsedLocation.zip,
  };
}

export function parseMailboxNumberRange(html: string): ParsedMailboxRange {
  const $ = cheerio.load(html);
  const mailboxNumbers = $('#f_boxid > option')
    .toArray()
    .map((element) => normalizeText($(element).text()))
    .filter(Boolean)
    .map((text) => {
      const match = text.match(/\d+/);

      return match ? Number(match[0]) : Number.NaN;
    })
    .filter(Number.isFinite);

  return {
    mailboxNumbers,
    mailboxMin: mailboxNumbers.length ? Math.min(...mailboxNumbers) : null,
    mailboxMax: mailboxNumbers.length ? Math.max(...mailboxNumbers) : null,
  };
}

export function normalizeText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function normalizeAddressKey(input: {
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
}) {
  return [
    normalizeComparable(input.streetAddress),
    normalizeComparable(input.city),
    normalizeComparable(input.state),
    normalizeComparable(input.postalCode),
  ].join('|');
}

export function slugify(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160) || 'address';
}

export function parsePriceCents(value: string) {
  const match = normalizeText(value).match(/(\d+(?:\.\d{1,2})?)/);

  return match ? Math.round(Number(match[1]) * 100) : 0;
}

export function stateCodeForName(name: string) {
  return stateCodeMap[normalizeText(name).toLowerCase()] ?? slugify(name).slice(0, 2).toUpperCase();
}

function normalizeComparable(value: string) {
  return normalizeText(value)
    .replace(/\bunit\b/gi, ' ')
    .replace(/[-#]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function textWithBreaks(
  $: cheerio.CheerioAPI,
  element: cheerio.Cheerio<any>,
) {
  const item = element.clone();

  item.find('br').replaceWith(' ');

  return normalizeText(item.text());
}

function ownText($: cheerio.CheerioAPI, element: unknown) {
  return normalizeText(
    $(element as any)
      .contents()
      .filter((_, node) => node.type === 'text')
      .text(),
  );
}

function cleanMailboxUnitText(value: string) {
  return normalizeText(
    String(value || '')
      .replace(/\bunit\s*#?\s*mailbox\b/gi, ' ')
      .replace(/#\s*mailbox\b/gi, ' ')
      .replace(/\bmailbox\b/gi, ' ')
      .replace(/\bunit\b/gi, ' ')
      .replace(/[-#]/g, ' '),
  );
}

function dropLeadingAddressLabel<T extends { text: string }>(rows: T[]) {
  if (rows.length < 2) {
    return rows;
  }

  const [first, second] = rows;
  if (!first || !second) {
    return rows;
  }

  const firstLooksLikeLabel = /\s-\s/.test(first.text) || !/^\d/.test(first.text);
  const secondLooksLikeStreet = /^\d/.test(second.text);

  return firstLooksLikeLabel && secondLooksLikeStreet ? rows.slice(1) : rows;
}

function isMailboxPlaceholderRow($: cheerio.CheerioAPI, element: unknown) {
  if (!element) return false;

  const item = $(element as any);

  return item.find('.t-placeholder').length > 0 && /MAILBOX/i.test(item.text());
}

function parseCityStateZip(value: string) {
  const text = normalizeText(value);
  const match = text.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);

  return {
    city: match?.[1] ?? '',
    state: match?.[2] ?? '',
    zip: match?.[3] ?? '',
  };
}

function isStateUrl(url: URL) {
  const parts = url.pathname.split('/').filter(Boolean);

  return parts.length === 3 && parts[0] === 'l' && parts[1] === 'usa';
}

function parseCountText(text: string) {
  const value = normalizeText(text);

  return /^\d+$/.test(value) ? Number(value) : null;
}

function getCountInsideLink($: cheerio.CheerioAPI, item: cheerio.Cheerio<any>) {
  let count: number | null = null;

  item.find('*').each((__, child) => {
    const currentCount = parseCountText($(child).text());
    if (count === null && currentCount !== null) {
      count = currentCount;
      $(child).remove();
    }
  });

  return count;
}

function getCountBesideLink($: cheerio.CheerioAPI, element: unknown) {
  let sibling = $(element as any).next();

  while (sibling.length) {
    if (sibling[0]?.tagName && sibling[0].tagName.toLowerCase() === 'br') {
      return null;
    }

    const count = parseCountText(sibling.text());
    if (count !== null) {
      return count;
    }

    sibling = sibling.next();
  }

  return null;
}

function getElementLink($: cheerio.CheerioAPI, element: unknown, baseUrl: string) {
  const item = $(element as any);
  for (const attrName of ['href', 'data-href', 'data-url']) {
    const value = item.attr(attrName);
    if (value) {
      return new URL(value, baseUrl).toString();
    }
  }

  const onclick = item.attr('onclick') || '';
  const match = onclick.match(/(?:location(?:\.href)?|window\.location(?:\.href)?|location\.assign|window\.open)\s*(?:=|\()\s*['"]?([^'";\s)]+)/i);

  return match?.[1] ? new URL(match[1], baseUrl).toString() : null;
}

function findSignupUrl($: cheerio.CheerioAPI, html: string, baseUrl: string) {
  const selectors = [
    'a[href*="signup/new"]',
    '[data-href*="signup/new"]',
    '[data-url*="signup/new"]',
    '[onclick*="signup/new"]',
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      const link = getElementLink($, element, baseUrl);
      if (link) return link;
    }
  }

  const match = html.match(/https?:\/\/signup\.anytimemailbox\.com\/signup\/new\?[^"'<>\\\s)]+/i)
    ?? html.match(/\/signup\/new\?[^"'<>\\\s)]+/i);

  return match?.[0] ? new URL(match[0], baseUrl).toString() : null;
}

const stateCodeMap: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  dc: 'DC',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'puerto rico': 'PR',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
};
