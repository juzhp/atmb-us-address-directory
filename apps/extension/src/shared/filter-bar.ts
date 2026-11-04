import type { FilterState } from './types.js';

const STYLE = `
:host { all: initial; display: block; margin: 0 0 12px; font: 12px/1.4 "Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans SC",Arial,sans-serif; color: #071a3f; }
.bar { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; padding: 8px 10px; border: 1px solid #b9d5e1; border-radius: 6px; background: #eef8fb; }
.bar b { font-weight: 600; color: #006a7b; }
label { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; user-select: none; }
input { margin: 0; width: 14px; height: 14px; }
.count { margin-left: auto; color: #52677f; white-space: nowrap; }
.count b { color: #071a3f; }
`;

const OPTIONS: Array<{ key: keyof FilterState; label: string }> = [
  { key: 'residentialOnly', label: '仅 RDI 住宅' },
  { key: 'hideBlacklisted', label: '排除黑名单' },
  { key: 'uspsNoOnly', label: '仅 USPS CMRA = N' },
  { key: 'recordedOnly', label: '仅已收录' },
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

  const state = { ...initial };
  for (const option of OPTIONS) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = state[option.key];
    input.addEventListener('change', () => {
      state[option.key] = input.checked;
      onChange({ ...state });
    });
    label.append(input, document.createTextNode(option.label));
    bar.append(label);
  }

  const count = document.createElement('span');
  count.className = 'count';
  bar.append(count);
  shadow.append(style, bar);

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

// 根据卡片上记录的匹配结果判断是否该被当前筛选条件隐藏
export function isHiddenByFilters(card: HTMLElement, filters: FilterState) {
  const recorded = card.dataset.usaddrRecorded === '1';
  if (filters.recordedOnly && !recorded) return true;
  if (filters.hideBlacklisted && card.dataset.usaddrBlacklisted === '1') return true;
  if (filters.residentialOnly && card.dataset.usaddrRdi !== 'Residential') return true;
  if (filters.uspsNoOnly && card.dataset.usaddrUsps !== 'N') return true;
  return false;
}
