import { C1_PRECHECK_LABELS, PLATFORMS, type AddressSource, type ExtensionLookupResult } from '@atmb/shared';

import { classify, type MatchState } from './classify.js';
import type { VerifyProvider, VerifyResult } from './verify.js';
import { buildBlacklistUrl, buildGoogleMapsUrl, buildSiteSearchUrl, formatPrice } from './links.js';

export const HOST_ATTR = 'data-usaddr-host';

function svgMask(paths: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
const EYE_ICON = svgMask('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
const EYE_OFF_ICON = svgMask('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>');

export interface PageAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  text?: string;
}

export interface CardModel {
  platform: AddressSource;
  result: Pick<ExtensionLookupResult, 'address' | 'blacklist'>;
  pageAddress: PageAddress;
  expanded: boolean;
  // 本地隐藏：只在列表页提供；不提供时不显示「隐藏」
  localHidden?: boolean;
  onToggleHidden?: () => void;
  // 实时查询 Smarty / USPS；不提供时不显示按钮
  verify?: (provider: VerifyProvider) => Promise<VerifyResult>;
}

export interface CardView {
  host: HTMLElement;
  state: MatchState;
  setExpanded(expanded: boolean): void;
  setLocalHidden(hidden: boolean): void;
}

const DOT_COLORS: Record<MatchState, string> = {
  good: '#15966a',
  caution: '#c98513',
  blacklisted: '#d93636',
  unrecorded: '#b4b2a9',
};

const STYLE = `
:host { all: initial; display: block; margin: 10px 0; font: 12px/1.45 "Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans SC",Arial,sans-serif; color: #071a3f; }
* { box-sizing: border-box; }
a { color: #006a7b; }
.chip { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px 0 8px; border-radius: 12px; border: 1px solid #d3e3ec; background: #f5f9fc; color: #071a3f; font-weight: 600; cursor: pointer; white-space: nowrap; user-select: none; }
.chip:hover { border-color: #68b7c6; }
.chip.blacklisted { border-color: #f0b4b4; background: #fff0f0; color: #8a1f1f; }
.chip.unrecorded { color: #526980; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.chev { font-size: 10px; color: #52677f; }
.strip { display: none; padding: 8px 10px; border: 1px solid #d3e3ec; border-left: 3px solid #057f93; border-radius: 0 6px 6px 0; background: #f5f9fc; }
.strip.blacklisted { border-left-color: #d93636; }
.strip.unrecorded { border-left-color: #b9d5e1; background: #fafcfd; }
:host([data-expanded="1"]) .strip { display: block; }
:host([data-expanded="1"]) .bar { display: none; }
.bar { display: flex; align-items: center; gap: 8px; }
.hide { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 10px; border-radius: 12px; border: 1px solid #d3e3ec; background: #fff; color: #52677f; font-weight: 600; cursor: pointer; white-space: nowrap; user-select: none; }
.hide::before { content: ""; width: 12px; height: 12px; background: currentColor; -webkit-mask: var(--eye) center / contain no-repeat; mask: var(--eye) center / contain no-repeat; }
.hide:hover { border-color: #68b7c6; color: #006a7b; }
.hide.on { border-color: #68b7c6; background: #eef8fb; color: #006a7b; }
.bar .hide { margin-left: auto; }
.head .hide { height: 20px; padding: 0 8px; margin-left: 8px; }
.head { display: flex; align-items: center; gap: 8px; color: #52677f; margin-bottom: 6px; flex-wrap: wrap; }
.head b { font-weight: 600; color: #071a3f; }
.head .collapse { margin-left: auto; cursor: pointer; color: #006a7b; white-space: nowrap; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.bd { display: inline-flex; align-items: center; gap: 4px; min-height: 22px; padding: 0 8px; border-radius: 5px; font-weight: 600; white-space: nowrap; }
.good { background: #e4f6ed; color: #116a49; }
.warn { background: #fff4df; color: #86570d; }
.muted { background: #edf5f8; color: #526980; }
.info { background: #eef8fb; color: #006a7b; }
.bad { background: #d93636; color: #fff; }
.links { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px 12px; }
.links .act { cursor: pointer; text-decoration: underline; color: #006a7b; }
.live .item { margin-top: 6px; padding: 6px 8px; border: 1px dashed #b9d5e1; border-radius: 5px; background: #fff; }
.live .title { font-weight: 600; margin-right: 6px; }
.live .addr { color: #52677f; margin: 2px 0 4px; }
.live .err { color: #8a1f1f; }
.spin { display: inline-block; width: 10px; height: 10px; margin-right: 6px; border: 2px solid #b9d5e1; border-top-color: #057f93; border-radius: 50%; vertical-align: -1px; animation: usaddr-spin .8s linear infinite; }
@keyframes usaddr-spin { to { transform: rotate(360deg); } }
.bl { margin-top: 6px; padding: 6px 8px; background: #fff0f0; border: 1px solid #f0b4b4; border-radius: 5px; color: #8a1f1f; }
.bl div + div { margin-top: 4px; }
.bl .reason { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-line; }
.bl a { color: #8a1f1f; }
.note { color: #52677f; }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(href: string, text: string) {
  const anchor = el('a', undefined, text);
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

function badge(text: string, tone: 'good' | 'warn' | 'muted' | 'info' | 'bad') {
  return el('span', `bd ${tone}`, text);
}

function fullAddressText(model: CardModel) {
  const { address } = model.result;
  if (address) return `${address.streetAddress} ${address.city}, ${address.state} ${address.postalCode}`;
  const page = model.pageAddress;
  if (page.street && page.city) return `${page.street} ${page.city}, ${page.state ?? ''} ${page.postalCode ?? ''}`.trim();
  return page.text ?? '';
}

export function renderCard(model: CardModel): CardView {
  const { address, blacklist } = model.result;
  const { state, chipText } = classify(model.result);

  const host = document.createElement('div');
  host.setAttribute(HOST_ATTR, '1');
  host.dataset.state = state;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLE;
  shadow.append(style);

  const chip = el('button', `chip ${state}`);
  chip.type = 'button';
  chip.title = '点击查看 usaddres 数据';
  const dot = el('span', 'dot');
  dot.style.background = DOT_COLORS[state];
  chip.append(dot, el('span', undefined, `usaddres · ${chipText}`), el('span', 'chev', '▼'));

  const strip = el('div', `strip ${state}`);
  const head = el('div', 'head');
  head.append(el('b', undefined, 'usaddres 数据'));
  if (address) {
    const via = address.source !== model.platform ? `，同址数据来自 ${PLATFORMS[address.source].label}` : '';
    head.append(el('span', undefined, `· 已收录（${PLATFORMS[address.source].label}${via}）`));
  } else {
    head.append(el('span', undefined, '· 未收录此地址，近期尚未抓取或已下架，请自行核实'));
  }
  const collapse = el('span', 'collapse', '▲ 收起');
  head.append(collapse);

  // 收起态芯片旁和展开态标题行各放一个「隐藏 / 取消隐藏」
  const hideToggles: HTMLElement[] = [];
  const onToggleHidden = model.onToggleHidden;
  function makeHideToggle() {
    const toggle = el('span', 'hide');
    toggle.addEventListener('click', () => onToggleHidden?.());
    hideToggles.push(toggle);
    return toggle;
  }
  if (onToggleHidden) head.append(makeHideToggle());
  strip.append(head);

  const row = el('div', 'row');
  if (address) {
    row.append(badge(`RDI ${address.rdi}`, address.rdi === 'Residential' ? 'good' : 'warn'));
    row.append(badge(`CMRA ${address.cmra}`, address.cmra === 'No' ? 'good' : 'warn'));
    row.append(
      address.uspsCmra
        ? badge(`USPS CMRA ${address.uspsCmra}`, address.uspsCmra === 'N' ? 'good' : 'warn')
        : badge('USPS CMRA —', 'muted'),
    );
    row.append(
      address.c1Precheck
        ? badge(`C1 预审 ${C1_PRECHECK_LABELS[address.c1Precheck]}`, address.c1Precheck === 'pass' ? 'good' : 'warn')
        : badge('C1 预审 —', 'muted'),
    );
    // 价格和邮箱编号是平台自己的；iPostal1 页面命中 ATMB 同址记录时只展示地址本身的属性
    if (address.source === model.platform) {
      row.append(badge(`${formatPrice(address.priceCents)} / 月`, 'info'));
      if (address.mailboxMin != null || address.mailboxMax != null) {
        row.append(badge(`邮箱 ${address.mailboxMin ?? 0} – ${address.mailboxMax ?? 0}`, 'info'));
      }
    }
  } else {
    row.append(badge('未收录', 'muted'));
  }
  if (blacklist.length > 0) {
    row.append(badge(`⚠ 黑名单 · ${blacklist.length} 条`, 'bad'));
  }
  strip.append(row);

  if (blacklist.length > 0) {
    const box = el('div', 'bl');
    for (const entry of blacklist) {
      const line = el('div');
      // 原因可能很长，最多显示 3 行，完整内容放 title
      const reason = el('div', 'reason', `· ${entry.reason}`);
      reason.title = entry.reason;
      line.append(reason, link(buildBlacklistUrl(entry), '查看记录'));
      if (entry.sourceUrl) {
        line.append(document.createTextNode(' '));
        line.append(link(entry.sourceUrl, '来源'));
      }
      box.append(line);
    }
    strip.append(box);
  }

  const links = el('div', 'links');
  if (address) links.append(link(buildSiteSearchUrl(address), '在 usaddres.com 查看'));
  const full = fullAddressText(model);
  if (full) links.append(link(buildGoogleMapsUrl(full), 'Google 地图'));
  strip.append(links);

  const verify = model.verify;
  if (verify) {
    const live = el('div', 'live');
    const providers: Array<{ provider: VerifyProvider; label: string; pending: string }> = [
      { provider: 'smarty', label: 'Smarty 实时查询', pending: 'Smarty 查询中…' },
      { provider: 'usps', label: 'USPS 实时查询', pending: 'USPS 查询中…（已在新标签页自动填写并查询）' },
    ];
    for (const { provider, label, pending } of providers) {
      const action = el('span', 'act', label);
      const item = el('div', 'item');
      let busy = false;
      action.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        item.replaceChildren(el('span', 'spin'), el('span', undefined, pending));
        if (!item.isConnected) live.append(item);
        const result = await verify(provider);
        busy = false;
        const title = el('span', 'title', provider === 'smarty' ? 'Smarty' : 'USPS');
        if (!result.ok) {
          item.replaceChildren(title, el('span', 'err', result.error ?? '查询失败'));
          return;
        }
        const fields = el('div', 'row');
        for (const field of result.fields ?? []) {
          fields.append(badge(`${field.label} ${field.value}`, field.tone));
        }
        item.replaceChildren(title, el('span', 'note', '实时结果'), el('div', 'addr', result.address ?? ''), fields);
      });
      links.append(action);
    }
    strip.append(live);
  }

  const bar = el('div', 'bar');
  bar.append(chip);
  if (onToggleHidden) bar.append(makeHideToggle());
  shadow.append(bar, strip);

  const view: CardView = {
    host,
    state,
    setExpanded(expanded) {
      host.dataset.expanded = expanded ? '1' : '0';
    },
    setLocalHidden(hidden) {
      for (const toggle of hideToggles) {
        toggle.textContent = hidden ? '取消隐藏' : '隐藏';
        toggle.classList.toggle('on', hidden);
        toggle.style.setProperty('--eye', hidden ? EYE_ICON : EYE_OFF_ICON);
      }
    },
  };
  chip.addEventListener('click', () => view.setExpanded(true));
  collapse.addEventListener('click', () => view.setExpanded(false));
  view.setExpanded(model.expanded);
  view.setLocalHidden(model.localHidden ?? false);
  return view;
}
