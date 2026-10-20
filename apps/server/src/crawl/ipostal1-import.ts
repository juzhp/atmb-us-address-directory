import { IPOSTAL1_US_STATES } from './ipostal1-parser.js';

// 离线导出文件（docs/muse-ipostal1-prompt.md 约定的格式）：每个州一条记录，body 是州接口响应原文
export interface Ipostal1ExportState {
  stateId: string;
  code: string;
  name: string;
  body: string;
}

export interface Ipostal1Export {
  fetchedAt: string | null;
  states: Ipostal1ExportState[];
  // 被跳过的州及原因（失败的州、内置州表里没有的州）
  skipped: string[];
}

const MAX_STATES = 200;

export function parseIpostal1Export(input: unknown): Ipostal1Export {
  const root = isRecord(input) ? input : null;
  if (!root) {
    throw new Error('导出文件不是 JSON 对象');
  }
  if (root.source !== 'ipostal1') {
    throw new Error('导出文件的 source 不是 ipostal1');
  }
  if (!Array.isArray(root.states) || root.states.length === 0) {
    throw new Error('导出文件缺少 states 列表');
  }
  if (root.states.length > MAX_STATES) {
    throw new Error('导出文件的 states 数量异常');
  }

  const knownStates = new Map(IPOSTAL1_US_STATES.map((state) => [state.stateId, state]));
  const states: Ipostal1ExportState[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (const entry of root.states) {
    if (!isRecord(entry)) {
      continue;
    }
    const stateId = String(entry.stateId ?? '').trim();
    const label = `${entry.code ?? ''} (${stateId || '?'})`.trim();

    if (!stateId || seen.has(stateId)) {
      skipped.push(`${label}: 缺少或重复的 stateId`);
      continue;
    }
    seen.add(stateId);

    if (entry.status !== 'ok') {
      skipped.push(`${label}: ${typeof entry.error === 'string' && entry.error ? entry.error : '抓取失败'}`);
      continue;
    }

    const known = knownStates.get(stateId);
    if (!known) {
      skipped.push(`${label}: 不在内置的美国州表中`);
      continue;
    }

    if (typeof entry.body !== 'string' || !entry.body.trim()) {
      skipped.push(`${label}: body 为空`);
      continue;
    }

    states.push({ stateId, code: known.code, name: known.name, body: entry.body });
  }

  if (states.length === 0) {
    throw new Error('导出文件里没有可导入的州');
  }

  return {
    fetchedAt: typeof root.fetchedAt === 'string' ? root.fetchedAt : null,
    states,
    skipped,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
