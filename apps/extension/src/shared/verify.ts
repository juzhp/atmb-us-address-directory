import {
  parseOneLineUsAddress,
  type ExtensionVerifyAddress,
  type ExtensionVerifyField,
  type ExtensionVerifyProvider,
  type ExtensionVerifyResult,
  type ExtensionVerifyTone,
} from '@atmb/shared';

// 实时查询：在用户自己的浏览器里打开 Smarty 演示页 / USPS 查询页，读取页面给出的结果带回数据卡片。
// 结果类型与网站共用（usaddres.com 页面也通过扩展发起同样的查询），定义在 @atmb/shared
export type VerifyProvider = ExtensionVerifyProvider;
export type VerifyAddress = ExtensionVerifyAddress;
export type VerifyTone = ExtensionVerifyTone;
export type VerifyField = ExtensionVerifyField;
export type VerifyResult = ExtensionVerifyResult;

export const SMARTY_DEMO_URL = 'https://www.smarty.com/products/us-address-verification';
export const USPS_LOOKUP_URL = 'https://tools.usps.com/zip-code-lookup.htm?byaddress';

export function buildVerifyAddress(input: { street?: string; city?: string; state?: string; postalCode?: string; text?: string }): VerifyAddress {
  if (input.street && input.city && input.state) {
    return { street: input.street, city: input.city, state: input.state, postalCode: input.postalCode ?? '' };
  }
  const parsed = parseOneLineUsAddress(input.text ?? [input.street, input.city, input.state, input.postalCode].filter(Boolean).join(' '));
  return { street: parsed.streetAddress, city: parsed.city, state: parsed.state, postalCode: parsed.postalCode };
}

export function oneLineAddress(address: VerifyAddress) {
  return [address.street, address.city, address.state, address.postalCode].filter(Boolean).join(' ');
}

// 演示页自己的分享链接格式：带上地址后页面会预填
export function smartyDemoUrl(address: VerifyAddress) {
  return `${SMARTY_DEMO_URL}?street=${encodeURIComponent(oneLineAddress(address))}&address-type=us-street-freeform`;
}

interface SmartyCandidate {
  delivery_line_1?: string;
  last_line?: string;
  metadata?: { rdi?: string };
  analysis?: { dpv_match_code?: string; dpv_cmra?: string; dpv_vacant?: string };
}

// 演示页的「Raw Output」是一段 JSON 文本：从页面文字里把第一条候选结果抠出来
export function extractSmartyCandidate(pageText: string): SmartyCandidate | null {
  const text = pageText.replace(/ /g, ' ');
  const anchor = text.indexOf('"delivery_line_1"');
  if (anchor < 0) return null;
  const start = text.lastIndexOf('{', anchor);
  if (start < 0) return null;

  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, index + 1)) as SmartyCandidate;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function flagField(label: string, value: string | undefined, goodValue: string): VerifyField {
  if (!value) return { label, value: '—', tone: 'muted' };
  return { label, value, tone: value === goodValue ? 'good' : 'warn' };
}

// DPV 代码单看字母不好懂，带上含义
const DPV_MEANINGS: Record<string, string> = {
  Y: 'Y 已确认',
  S: 'S 单元号不符',
  D: 'D 缺单元号',
  N: 'N 未确认',
};

function dpvField(label: string, value: string | undefined): VerifyField {
  const field = flagField(label, value, 'Y');
  return value ? { ...field, value: DPV_MEANINGS[value] ?? value } : field;
}

export function smartyResultFromCandidate(candidate: SmartyCandidate): VerifyResult {
  const rdi = candidate.metadata?.rdi;
  const analysis = candidate.analysis ?? {};
  return {
    ok: true,
    address: [candidate.delivery_line_1, candidate.last_line].filter(Boolean).join(', '),
    fields: [
      rdi ? { label: 'RDI', value: rdi, tone: rdi === 'Residential' ? 'good' : 'warn' } : { label: 'RDI', value: '—', tone: 'muted' },
      flagField('CMRA', analysis.dpv_cmra, 'N'),
      dpvField('DPV 匹配', analysis.dpv_match_code),
      flagField('空置', analysis.dpv_vacant, 'N'),
    ],
  };
}

// USPS 结果模板里明细的固定顺序（中文站只是把标题翻译了，顺序不变）
const USPS_DETAIL_INDEX = { carrierRoute: 0, county: 1, cmra: 4, dpvConfirmation: 13 } as const;

function uspsValue(details: string[], index: number) {
  const value = (details[index] ?? '').trim();
  return value && value !== '-' ? value : undefined;
}

export function uspsResultFromPage(addressLines: string[], details: string[], resultCount: number): VerifyResult {
  const fields: VerifyField[] = [
    flagField('CMRA', uspsValue(details, USPS_DETAIL_INDEX.cmra), 'N'),
    dpvField('DPV 确认', uspsValue(details, USPS_DETAIL_INDEX.dpvConfirmation)),
  ];
  const county = uspsValue(details, USPS_DETAIL_INDEX.county);
  if (county) fields.push({ label: '县', value: county, tone: 'info' });
  if (resultCount > 1) fields.push({ label: '结果', value: `共 ${resultCount} 条，取第一条`, tone: 'info' });

  return {
    ok: true,
    address: addressLines.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join(', '),
    fields,
  };
}
