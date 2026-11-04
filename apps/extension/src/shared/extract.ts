// 从页面文本里提取地址字段的纯函数，不碰 DOM，方便在 node --test 下测试

export interface CityLine {
  city: string;
  state: string;
  postalCode: string;
}

export interface ParsedAddress extends CityLine {
  street: string;
}

const CITY_LINE_PATTERN = /^(.+?),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/;
// 页面里任意一段文字中是否含有 "…, ST 12345" 这样的美国地址尾巴
export const ADDRESS_TAIL_PATTERN = /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/;

export function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

// "Abilene, TX 79605" → { city, state, postalCode }
export function parseCityLine(line: string): CityLine | null {
  const match = collapseWhitespace(line).match(CITY_LINE_PATTERN);
  if (!match) return null;
  return { city: match[1]!.trim(), state: match[2]!, postalCode: match[3]! };
}

// 把 "<br>" 分隔的多行 HTML 拆成去标签后的文本行
export function splitHtmlLines(html: string) {
  return html
    .split(/<br\s*\/?>/i)
    .map((part) => collapseWhitespace(part.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')))
    .filter(Boolean);
}

// 多行地址（最后一行是 "City, ST zip"，可能还跟着 "United States"）→ 结构化字段
export function parseAddressLines(lines: string[]): ParsedAddress | null {
  const cleaned = lines.map(collapseWhitespace).filter((line) => line && !/^united states$/i.test(line));
  for (let index = cleaned.length - 1; index >= 1; index -= 1) {
    const cityLine = parseCityLine(cleaned[index]!);
    if (cityLine) {
      return { street: cleaned.slice(0, index).join(' '), ...cityLine };
    }
  }
  return null;
}

// ATMB 详情页街道行形如 "2438 Industrial Blvd #MAILBOX" / "… # MAILBOX"
export function stripMailboxPlaceholder(street: string) {
  return collapseWhitespace(street.replace(/#?\s*MAILBOX\b/gi, '').replace(/#\s*$/, ''));
}

// 一行文本里切出 "…, ST 12345" 之前的部分作为宽松匹配文本
export function extractAddressText(text: string) {
  const collapsed = collapseWhitespace(text);
  const match = collapsed.match(/^(.*?\b[A-Z]{2}\s+\d{5}(?:-\d{4})?)\b/);
  return match ? match[1]! : null;
}

export function extractZip(text: string) {
  const match = text.match(/\b[A-Z]{2}\s+(\d{5})(?:-\d{4})?\b/);
  return match ? match[1]! : '';
}

// 从 "/s/abilene-2438-industrial-blvd" 或完整 URL 里取 slug
export function atmbSlugFromHref(href: string | null | undefined) {
  if (!href) return null;
  const match = href.match(/\/s\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]!) : null;
}
