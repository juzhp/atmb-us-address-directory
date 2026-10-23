import { findUsStateCodeByKeyword } from './us-states.js';

export interface ParsedUsAddress {
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
}

export const US_ZIP_PATTERN = /^\d{5}(?:-\d{4})?$/;
export const BLACKLIST_REASON_MAX_LENGTH = 500;

const COUNTRY_SUFFIX = /[,\s]+(?:usa|u\.s\.a\.?|united states(?: of america)?|u\.s\.?|us)\s*$/i;
const ZIP_TAIL = /[,\s]+(\d{5}(?:-\d{4})?)\s*$/;

// 一行地址一键解析："123 Main St, Suite 5, Los Angeles, CA 90001"。
// 解析不到的字段返回空字符串，由用户手动补齐；不抛错。
export function parseOneLineUsAddress(input: string): ParsedUsAddress {
  const text = String(input ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(COUNTRY_SUFFIX, '')
    .trim();
  const zipMatch = text.match(ZIP_TAIL);

  if (!zipMatch) {
    return { streetAddress: text, city: '', state: '', postalCode: '' };
  }

  const postalCode = zipMatch[1] ?? '';
  const { state, remainder } = takeStateFromEnd(text.slice(0, zipMatch.index));
  const { streetAddress, city } = splitStreetAndCity(remainder);

  return { streetAddress, city, state, postalCode };
}

// 从结尾取 1~3 个词当州名（"CA" / "California" / "New York" / "District of Columbia"），不跨逗号
function takeStateFromEnd(value: string) {
  const stripped = value.replace(/[,\s]+$/, '');
  const words = stripped.split(' ');

  for (let count = 1; count <= 3 && count <= words.length; count += 1) {
    const token = words.slice(-count).join(' ').replace(/\.$/, '');

    if (token.includes(',')) {
      break;
    }

    const code = findUsStateCodeByKeyword(token);

    if (code) {
      return {
        state: code,
        remainder: words.slice(0, -count).join(' ').replace(/[,\s]+$/, ''),
      };
    }
  }

  return { state: '', remainder: stripped };
}

// 有逗号：最后一段是城市，其余合并为街道（保留 "Suite 5" 这类附加段）；无逗号：最后一个词当城市
function splitStreetAndCity(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { streetAddress: '', city: '' };
  }

  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
    const city = parts.pop() ?? '';
    return { streetAddress: parts.join(', '), city };
  }

  const words = trimmed.split(' ');
  const city = words.length > 1 ? words.pop() ?? '' : '';
  return { streetAddress: words.join(' '), city };
}
