export const APP_NAME = 'ATMB Address Guide';

export * from './us-states.js';

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

export type AddressRdi = 'Residential' | 'Commercial';
export type AddressCmra = 'Yes' | 'No';
export type AddressRdiFilter = AddressRdi | 'none';
export type AddressCmraFilter = AddressCmra | 'none';
export type AddressPriceFilter = 'all' | 'lt10' | 'lt20' | 'gte20';

export interface AdminAddressListItem {
  recordSource: 'address' | 'discovered';
  canEdit: boolean;
  id: number;
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
