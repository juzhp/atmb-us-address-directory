import type { ExtensionLookupResult } from '@atmb/shared';

import { t } from './i18n.js';

export type MatchState = 'blacklisted' | 'good' | 'caution' | 'unrecorded';

export interface Classification {
  state: MatchState;
  // 收起态标签上的短文案
  chipText: string;
}

// 标签颜色与文案：黑名单 > 未收录 > 住宅且无风险项 > 其余提示风险项
export function classify(result: Pick<ExtensionLookupResult, 'address' | 'blacklist'>): Classification {
  const { address, blacklist } = result;
  const cautions: string[] = [];
  if (address) {
    if (address.rdi === 'Commercial') cautions.push(t('labelCommercial'));
    if (address.cmra === 'Yes') cautions.push('CMRA Yes');
    if (address.uspsCmra === 'Y') cautions.push('USPS CMRA Y');
    if (address.c1Precheck === 'fail') cautions.push(t('chipC1Fail'));
  }

  if (blacklist.length > 0) {
    const tail = address ? (cautions[0] ?? t('labelResidential')) : t('labelUnrecorded');
    return { state: 'blacklisted', chipText: t('chipBlacklist', blacklist.length, tail) };
  }
  if (!address) {
    return { state: 'unrecorded', chipText: t('labelUnrecorded') };
  }
  if (cautions.length === 0) {
    return { state: 'good', chipText: t('chipGood') };
  }
  return { state: 'caution', chipText: cautions.join(' · ') };
}
