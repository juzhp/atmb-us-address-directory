// 地址归一化：服务端入库去重、黑名单匹配与浏览器扩展共用同一套规则
export function normalizeComparable(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bunit\b/gi, ' ')
    .replace(/[-#]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
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

export function zip5(postalCode: unknown) {
  const match = String(postalCode ?? '').match(/\d{5}/);
  return match ? match[0] : '';
}
