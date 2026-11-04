import { DEFAULT_FILTERS, DEFAULT_SETTINGS, type FilterState, type Settings } from './types.js';

const SETTINGS_KEY = 'settings';
const FILTERS_KEY = 'filters';

export async function readSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] as Partial<Settings> | undefined) };
}

export async function writeSettings(patch: Partial<Settings>) {
  const current = await readSettings();
  await chrome.storage.sync.set({ [SETTINGS_KEY]: { ...current, ...patch } });
}

export async function readFilters(): Promise<FilterState> {
  const stored = await chrome.storage.sync.get(FILTERS_KEY);
  return { ...DEFAULT_FILTERS, ...(stored[FILTERS_KEY] as Partial<FilterState> | undefined) };
}

export async function writeFilters(filters: FilterState) {
  await chrome.storage.sync.set({ [FILTERS_KEY]: filters });
}

export function onSettingsChanged(callback: (settings: Settings) => void) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[SETTINGS_KEY]) return;
    callback({ ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue as Partial<Settings> | undefined) });
  });
}
