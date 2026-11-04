import type {
  ExtensionLookupItem,
  ExtensionLookupRequest,
  ExtensionLookupResponse,
  ExtensionLookupResult,
} from '@atmb/shared';

export type { ExtensionLookupItem, ExtensionLookupRequest, ExtensionLookupResponse, ExtensionLookupResult };

declare const __API_BASE__: string;
declare const __DEV__: boolean;

export const API_BASE = __API_BASE__;
export const IS_DEV = __DEV__;

export interface Settings {
  // 数据条默认展开；关闭时只显示一枚芯片，点击再展开
  defaultExpanded: boolean;
  // 列表页顶部显示筛选栏
  showFilterBar: boolean;
  // 未收录地址也显示灰色提示
  showUnrecorded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultExpanded: false,
  showFilterBar: true,
  showUnrecorded: true,
};

export interface FilterState {
  residentialOnly: boolean;
  hideBlacklisted: boolean;
  uspsNoOnly: boolean;
  recordedOnly: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  residentialOnly: false,
  hideBlacklisted: false,
  uspsNoOnly: false,
  recordedOnly: false,
};

export type LookupMessage =
  | { type: 'lookup'; items: ExtensionLookupItem[] }
  | { type: 'clearCache' }
  | { type: 'cacheStats' };

export interface LookupReply {
  results?: ExtensionLookupResult[];
  error?: string;
}

export interface CacheStats {
  entries: number;
  lastLookupAt: string | null;
  apiBase: string;
}
