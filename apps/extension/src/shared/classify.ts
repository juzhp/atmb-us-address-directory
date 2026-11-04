import { C1_PRECHECK_LABELS, type ExtensionLookupResult } from '@atmb/shared';

export type MatchState = 'blacklisted' | 'good' | 'caution' | 'unrecorded';

export interface Classification {
  state: MatchState;
  // 收起态芯片上的短文案
  chipText: string;
}

// 芯片颜色与文案：黑名单 > 未收录 > 住宅且无风险项 > 其余提示风险项
export function classify(result: Pick<ExtensionLookupResult, 'address' | 'blacklist'>): Classification {
  const { address, blacklist } = result;
  const cautions: string[] = [];
  if (address) {
    if (address.rdi === 'Commercial') cautions.push('商业');
    if (address.cmra === 'Yes') cautions.push('CMRA Yes');
    if (address.uspsCmra === 'Y') cautions.push('USPS CMRA Y');
    if (address.c1Precheck === 'fail') cautions.push(`C1 ${C1_PRECHECK_LABELS.fail}`);
  }

  if (blacklist.length > 0) {
    const tail = address ? (cautions[0] ?? '住宅') : '未收录';
    return { state: 'blacklisted', chipText: `黑名单 ${blacklist.length} 条 · ${tail}` };
  }
  if (!address) {
    return { state: 'unrecorded', chipText: '未收录' };
  }
  if (cautions.length === 0) {
    return { state: 'good', chipText: '住宅 · 无黑名单' };
  }
  return { state: 'caution', chipText: cautions.join(' · ') };
}
