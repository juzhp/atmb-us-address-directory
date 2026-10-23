export const APP_NAME = 'ATMB Address Guide';

export * from './us-states.js';
export * from './address-parse.js';

export interface AdminUserProfile {
  id: number;
  username: string;
  displayName: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: AdminUserProfile;
}

export const ADDRESS_SOURCES = ['anytimemailbox', 'ipostal1'] as const;
export type AddressSource = (typeof ADDRESS_SOURCES)[number];

export interface PlatformInfo {
  label: string;
  detailHosts: readonly string[];
  referralUrl: string;
  referralCookieName: string;
}

export const PLATFORMS: Record<AddressSource, PlatformInfo> = {
  anytimemailbox: {
    label: 'ATMB',
    detailHosts: ['www.anytimemailbox.com', 'locations.anytimemailbox.com'],
    referralUrl: 'https://anytimemailbox.referralrock.com/l/1RENHONGLIU21/',
    referralCookieName: 'atmb_referral_visited',
  },
  ipostal1: {
    label: 'iPostal1',
    detailHosts: ['ipostal1.com', 'www.ipostal1.com'],
    referralUrl: 'https://ipostal1.com/?ref=7904',
    referralCookieName: 'ipostal1_referral_visited',
  },
};

export type AddressRdi = 'Residential' | 'Commercial';
export type AddressCmra = 'Yes' | 'No';
export type AddressRdiFilter = AddressRdi | 'none';
export type AddressCmraFilter = AddressCmra | 'none';
export type AddressPriceFilter = 'all' | 'lt10' | 'lt20' | 'gte20';
export type AddressUspsCmra = 'Y' | 'N';
export type AddressC1Precheck = 'pass' | 'fail';
export type AddressUspsCmraFilter = AddressUspsCmra | 'none';
export type AddressC1PrecheckFilter = AddressC1Precheck | 'none';
export const C1_PRECHECK_LABELS: Record<AddressC1Precheck, string> = {
  pass: '通过',
  fail: '不通过',
};

export interface AdminAddressListItem {
  recordSource: 'address' | 'discovered';
  canEdit: boolean;
  id: number;
  source: AddressSource;
  name: string;
  anytimeUrl: string;
  signupUrl: string | null;
  googleMapsUrl: string | null;
  country: string;
  state: string;
  stateName: string;
  city: string;
  streetAddress: string;
  postalCode: string;
  fullAddress: string;
  priceCents: number;
  priceCurrency: string;
  pricePeriod: string;
  rdi: AddressRdi | null;
  cmra: AddressCmra | null;
  uspsCmra: AddressUspsCmra | null;
  uspsCmraUpdatedAt: string | null;
  c1Precheck: AddressC1Precheck | null;
  c1PrecheckUpdatedAt: string | null;
  mailboxMin: number | null;
  mailboxMax: number | null;
  mailboxCount: number | null;
  isFeatured: boolean;
  isActive: boolean;
  isVisible: boolean;
  statusNote: string | null;
  imageUrl: string | null;
  updatedAt: string;
}

export interface AdminAddressListResponse {
  items: AdminAddressListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminAddressStats {
  totalAddresses: number;
  activeAddresses: number;
  residentialAddresses: number;
  todayAdded: number;
  todayRemoved: number;
}

export interface AdminStateOption {
  id: number;
  name: string;
  code: string;
  slug: string;
}

export type SmartyConnectionStatus = 'not_configured' | 'connected' | 'failed';
export type UpdateFrequencyDays = 1 | 2 | 3 | 4 | 5 | 10;
export type UpdateMinute = 0 | 30;

export interface AdminSystemSettings {
  smartyAuthId: string;
  hasSmartyAuthToken: boolean;
  smartyConnectionStatus: SmartyConnectionStatus;
  smartyConnectionMessage: string | null;
  smartyLastTestedAt: string | null;
  smartyRemainingCredits: number | null;
  smartyMonthlyUsed: number | null;
  smartyCreditsUpdatedAt: string | null;
  autoUpdateEnabled: boolean;
  updateFrequencyDays: UpdateFrequencyDays | null;
  updateHour: number;
  updateMinute: UpdateMinute;
  nextRunAt: string | null;
  headCode: string;
  updatedAt: string;
}

export type AdminProxyTestStatus = 'not_tested' | 'success' | 'failed';

export interface AdminProxyListItem {
  id: number;
  url: string;
  note: string | null;
  isActive: boolean;
  lastTestStatus: AdminProxyTestStatus;
  lastTestMessage: string | null;
  lastTestSampleAddress: string | null;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProxyListResponse {
  items: AdminProxyListItem[];
}

export interface AdminProxyResponse {
  item: AdminProxyListItem;
}
export interface AdminSystemSettingsResponse {
  settings: AdminSystemSettings;
}

export interface HeadCodeCheckResponse {
  lineCount: number;
  characterCount: number;
  warnings: string[];
}

export type AdminTaskCreatedType = 'manual' | 'system';
export type AdminTaskStatus = 'running' | 'pause_requested' | 'paused' | 'stop_requested' | 'stopped' | 'completed';
export type AdminSubtaskType = 'fetch_states' | 'fetch_names' | 'fetch_addresses' | 'fetch_mailbox_numbers' | 'sync_smarty';
export type AdminSubtaskExecutionStatus = 'pending' | 'running' | 'paused' | 'completed';
export type AdminSubtaskResultStatus = 'success' | 'failed' | 'stopped';

export interface AdminTaskProgress {
  taskType: AdminSubtaskType;
  current: number;
  total: number | null;
  percent: number | null;
  message: string;
}

export interface AdminTaskListItem {
  id: number;
  batchCode: string;
  generatedAt: string;
  createdType: AdminTaskCreatedType;
  platform: AddressSource;
  status: AdminTaskStatus;
  note: string | null;
  createdBy: string;
  pendingCount: number;
  successCount: number;
  failedCount: number;
  totalCount: number;
  progress: AdminTaskProgress | null;
  updatedAt: string;
}

export interface AdminIpostal1ImportStats {
  states: number;
  parsed: number;
  skippedAtmb: number;
  skippedExisting: number;
  staged: number;
  warnings: string[];
}

export interface AdminIpostal1ImportAddress {
  storeId: string;
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  detailUrl: string;
}

export interface AdminIpostal1ImportDuplicate {
  ipostal1: AdminIpostal1ImportAddress;
  atmb: {
    id: number;
    name: string;
    streetAddress: string;
    city: string;
    state: string;
    postalCode: string;
    anytimeUrl: string;
  };
}

// 上传后仅解析与统计，等人工确认后才创建任务；details 供人工核对去重结果
export interface AdminIpostal1ImportPreviewResponse {
  uploadId: string;
  fetchedAt: string | null;
  stats: AdminIpostal1ImportStats;
  details: {
    duplicates: AdminIpostal1ImportDuplicate[];
    existing: AdminIpostal1ImportAddress[];
    staged: AdminIpostal1ImportAddress[];
  };
}

export interface AdminIpostal1ImportResponse {
  item: AdminTaskListItem;
  stats: AdminIpostal1ImportStats;
}

export interface AdminTaskListResponse {
  items: AdminTaskListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminTaskStats {
  totalTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedSubtasks: number;
}

export interface AdminSubtaskListItem {
  id: number;
  taskType: AdminSubtaskType;
  createdAt: string;
  executionStatus: AdminSubtaskExecutionStatus;
  resultStatus: AdminSubtaskResultStatus | null;
  errorMessage: string | null;
  progress: AdminTaskProgress | null;
  updatedAt: string;
}

export interface AdminTaskSubtasksResponse {
  task: AdminTaskListItem;
  items: AdminSubtaskListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const BLACKLIST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type BlacklistStatus = (typeof BLACKLIST_STATUSES)[number];
export type BlacklistSubmittedBy = 'visitor' | 'admin';
export const BLACKLIST_STATUS_LABELS: Record<BlacklistStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
};

export interface AdminBlacklistItem {
  id: number;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  reason: string;
  sourceUrl: string | null;
  status: BlacklistStatus;
  submittedBy: BlacklistSubmittedBy;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBlacklistListResponse {
  items: AdminBlacklistItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  pendingCount: number;
}

export interface AdminBlacklistResponse {
  item: AdminBlacklistItem;
}
