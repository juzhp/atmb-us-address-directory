import type {
  AddressSource,
  ExtensionLookupItem,
  ExtensionLookupRequest,
  ExtensionLookupResponse,
  ExtensionLookupResult,
} from '@atmb/shared';

import type { VerifyAddress, VerifyProvider, VerifyResult } from './verify.js';

export type { ExtensionLookupItem, ExtensionLookupRequest, ExtensionLookupResponse, ExtensionLookupResult };

declare const __API_BASE__: string;
declare const __DEV__: boolean;

// 构建时由 esbuild define 注入；单测直接以 node 加载源码时没有这两个全局，给默认值
export const API_BASE = typeof __API_BASE__ === 'undefined' ? 'https://usaddres.com' : __API_BASE__;
export const IS_DEV = typeof __DEV__ === 'undefined' ? false : __DEV__;

export interface Settings {
  // 平台功能开关：默认关闭，由用户手动开启；开启即表示通过 usaddres 推荐链接访问该平台
  enableAnytimemailbox: boolean;
  enableIpostal1: boolean;
  // 数据条默认展开；关闭时只显示一枚芯片，点击再展开
  defaultExpanded: boolean;
  // 列表页顶部显示筛选栏
  showFilterBar: boolean;
  // 未收录地址也显示灰色提示
  showUnrecorded: boolean;
  // 实时查询拿到结果后自动关闭 Smarty / USPS 查询标签页；默认不关，方便回看原始结果
  autoCloseVerifyTab: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enableAnytimemailbox: false,
  enableIpostal1: false,
  defaultExpanded: false,
  showFilterBar: true,
  showUnrecorded: true,
  autoCloseVerifyTab: false,
};

// 列表页筛选：每一项都是完整的下拉选择，'all' 表示不限制
export interface FilterState {
  recorded: 'all' | 'recorded' | 'unrecorded';
  rdi: 'all' | 'Residential' | 'Commercial';
  cmra: 'all' | 'No' | 'Yes';
  usps: 'all' | 'N' | 'Y' | 'unknown';
  c1: 'all' | 'pass' | 'fail' | 'unknown';
  blacklist: 'all' | 'exclude' | 'only';
  // 本地隐藏的地址：默认不显示，可单独列出来取消隐藏
  hidden: 'exclude' | 'only' | 'all';
}

export const DEFAULT_FILTERS: FilterState = {
  recorded: 'all',
  rdi: 'all',
  cmra: 'all',
  usps: 'all',
  c1: 'all',
  blacklist: 'all',
  hidden: 'exclude',
};

export const FILTER_OPTIONS: { [K in keyof FilterState]: Array<{ value: FilterState[K]; label: string }> } = {
  recorded: [
    { value: 'all', label: '全部' },
    { value: 'recorded', label: '已收录' },
    { value: 'unrecorded', label: '未收录' },
  ],
  rdi: [
    { value: 'all', label: '全部' },
    { value: 'Residential', label: '住宅' },
    { value: 'Commercial', label: '商业' },
  ],
  cmra: [
    { value: 'all', label: '全部' },
    { value: 'No', label: 'No' },
    { value: 'Yes', label: 'Yes' },
  ],
  usps: [
    { value: 'all', label: '全部' },
    { value: 'N', label: 'N' },
    { value: 'Y', label: 'Y' },
    { value: 'unknown', label: '未知' },
  ],
  c1: [
    { value: 'all', label: '全部' },
    { value: 'pass', label: '通过' },
    { value: 'fail', label: '不通过' },
    { value: 'unknown', label: '未知' },
  ],
  blacklist: [
    { value: 'all', label: '全部' },
    { value: 'exclude', label: '排除黑名单' },
    { value: 'only', label: '仅黑名单' },
  ],
  hidden: [
    { value: 'exclude', label: '不显示' },
    { value: 'only', label: '仅已隐藏' },
    { value: 'all', label: '全部' },
  ],
};

export type LookupMessage =
  | { type: 'lookup'; items: ExtensionLookupItem[] }
  | { type: 'clearCache' }
  | { type: 'cacheStats' }
  // 走一次推荐链接再回到 returnUrl；tabId 缺省为发消息的标签页，newTab 时另开标签页且不跳回
  | { type: 'referral'; platform: AddressSource; returnUrl?: string | null; tabId?: number; newTab?: boolean }
  // 数据卡片发起实时查询：后台打开 Smarty / USPS 页面
  | { type: 'verify'; provider: VerifyProvider; address: VerifyAddress; requestId: string }
  // Smarty / USPS 页面里的脚本问后台：这个标签页有没有待办的查询
  | { type: 'verifyJob' }
  // Smarty / USPS 页面里的脚本把结果交回后台
  | { type: 'verifyResult'; result: VerifyResult };

export interface VerifyJob {
  provider: VerifyProvider;
  address: VerifyAddress;
  originTabId: number;
  requestId: string;
}

export interface VerifyJobReply {
  job: Pick<VerifyJob, 'provider' | 'address'> | null;
}

export interface VerifyStartReply {
  started?: boolean;
  error?: string;
}

// 后台推给发起查询的页面
export interface VerifyPush {
  type: 'verifyResult';
  requestId: string;
  provider: VerifyProvider;
  result: VerifyResult;
}

export interface LookupReply {
  results?: ExtensionLookupResult[];
  error?: string;
}

export interface ReferralReply {
  // 30 天内已归因，直接用
  done?: boolean;
  // 已开始跳转，当前页面即将离开
  started?: boolean;
  // 同一标签页或同一平台已有跳转在进行
  pending?: boolean;
  error?: string;
}

export interface CacheStats {
  entries: number;
  lastLookupAt: string | null;
  apiBase: string;
}
