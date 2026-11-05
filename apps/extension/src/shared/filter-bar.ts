import { DEFAULT_FILTERS, FILTER_OPTIONS, type FilterState } from './types.js';

const STYLE = `
:host { all: initial; display: block; margin: 0 0 12px; font: 12px/1.4 "Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans SC",Arial,sans-serif; color: #071a3f; }
.bar { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding: 8px 10px; border: 1px solid #b9d5e1; border-radius: 6px; background: #eef8fb; }
.bar b { font-weight: 600; color: #006a7b; }
label { display: inline-flex; align-items: center; gap: 4px; color: #52677f; white-space: nowrap; }
select { height: 24px; padding: 0 4px; border: 1px solid #b9d5e1; border-radius: 4px; background: #fff; color: #071a3f; font: inherit; cursor: pointer; }
select.active { border-color: #057f93; color: #006a7b; font-weight: 600; }
.reset { color: #006a7b; cursor: pointer; text-decoration: underline; }
.count { margin-left: auto; color: #52677f; white-space: nowrap; }
.count b { color: #071a3f; }
`;

const FIELDS: Array<{ key: keyof FilterState; label: string }> = [
  { key: 'recorded', label: '收录' },
  { key: 'rdi', label: 'RDI' },
  { key: 'cmra', label: 'CMRA' },
  { key: 'usps', label: 'USPS CMRA' },
  { key: 'c1', label: 'C1 预审' },
  { key: 'blacklist', label: '黑名单' },
  { key: 'hidden', label: '已隐藏' },
];

export interface FilterBar {
  host: HTMLElement;
  setCount(shown: number, total: number): void;
}

export function renderFilterBar(initial: FilterState, onChange: (filters: FilterState) => void): FilterBar {
  const host = document.createElement('div');
  host.setAttribute('data-usaddr-filter', '1');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLE;

  const bar = document.createElement('div');
  bar.className = 'bar';
  const title = document.createElement('b');
  title.textContent = 'usaddres 筛选';
  bar.append(title);

  const state: FilterState = { ...initial };
  const selects = new Map<keyof FilterState, HTMLSelectElement>();

  function refreshActive() {
    for (const [key, select] of selects) {
      select.classList.toggle('active', state[key] !== DEFAULT_FILTERS[key]);
    }
    const changed = (Object.keys(state) as Array<keyof FilterState>).some((key) => state[key] !== DEFAULT_FILTERS[key]);
    reset.style.display = changed ? '' : 'none';
  }

  for (const field of FIELDS) {
    const label = document.createElement('label');
    label.append(document.createTextNode(field.label));
    const select = document.createElement('select');
    for (const option of FILTER_OPTIONS[field.key]) {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      select.append(element);
    }
    select.value = state[field.key];
    select.addEventListener('change', () => {
      (state as Record<keyof FilterState, string>)[field.key] = select.value;
      refreshActive();
      onChange({ ...state });
    });
    selects.set(field.key, select);
    label.append(select);
    bar.append(label);
  }

  const reset = document.createElement('span');
  reset.className = 'reset';
  reset.textContent = '重置';
  reset.addEventListener('click', () => {
    Object.assign(state, DEFAULT_FILTERS);
    for (const [key, select] of selects) select.value = state[key];
    refreshActive();
    onChange({ ...state });
  });
  bar.append(reset);

  const count = document.createElement('span');
  count.className = 'count';
  bar.append(count);
  shadow.append(style, bar);
  refreshActive();

  return {
    host,
    setCount(shown, total) {
      count.innerHTML = '';
      const strong = document.createElement('b');
      strong.textContent = String(shown);
      count.append(document.createTextNode('显示 '), strong, document.createTextNode(` / ${total}`));
      if (total > shown) count.append(document.createTextNode(` · 隐藏 ${total - shown}`));
    },
  };
}

// 卡片上记录的匹配结果（见 runtime 的 markCardResult）；数据项筛选只对已收录地址有意义，未收录一律隐藏
export function isHiddenByFilters(card: { dataset: DOMStringMap }, filters: FilterState) {
  const data = card.dataset;
  const recorded = data.usaddrRecorded === '1';
  const blacklisted = data.usaddrBlacklisted === '1';

  const localHidden = data.usaddrLocalHidden === '1';
  if (filters.hidden === 'exclude' && localHidden) return true;
  if (filters.hidden === 'only' && !localHidden) return true;

  if (filters.recorded === 'recorded' && !recorded) return true;
  if (filters.recorded === 'unrecorded' && recorded) return true;
  if (filters.blacklist === 'exclude' && blacklisted) return true;
  if (filters.blacklist === 'only' && !blacklisted) return true;

  const matchesValue = (filter: string, value: string | undefined) => {
    if (filter === 'all') return true;
    if (!recorded) return false;
    return filter === 'unknown' ? !value : value === filter;
  };
  if (!matchesValue(filters.rdi, data.usaddrRdi)) return true;
  if (!matchesValue(filters.cmra, data.usaddrCmra)) return true;
  if (!matchesValue(filters.usps, data.usaddrUsps)) return true;
  if (!matchesValue(filters.c1, data.usaddrC1)) return true;
  return false;
}
