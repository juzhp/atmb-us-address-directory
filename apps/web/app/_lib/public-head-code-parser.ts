export type PublicHeadCodeTagName = 'meta' | 'link' | 'script' | 'style' | 'noscript';

export interface PublicHeadCodeElement {
  tagName: PublicHeadCodeTagName;
  attributes: Record<string, string | boolean>;
  innerHTML: string | null;
}

const PAIRED_TAG_PATTERN = /<(script|style|noscript)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
const VOID_TAG_PATTERN = /<(meta|link)\b([^>]*?)\/?>/gi;
const ATTRIBUTE_PATTERN = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const ATTRIBUTE_NAME_MAP: Record<string, string> = {
  charset: 'charSet',
  'http-equiv': 'httpEquiv',
  crossorigin: 'crossOrigin',
  referrerpolicy: 'referrerPolicy',
  fetchpriority: 'fetchPriority',
  nomodule: 'noModule',
};

interface MatchedHeadTag extends PublicHeadCodeElement {
  index: number;
}

export function parsePublicHeadCodeElements(headCode: string): PublicHeadCodeElement[] {
  const elements: MatchedHeadTag[] = [];

  collectPairedTags(headCode, elements);
  collectVoidTags(headCode, elements);

  return elements
    .sort((left, right) => left.index - right.index)
    .map(({ index: _index, ...element }) => element);
}

function collectPairedTags(headCode: string, elements: MatchedHeadTag[]) {
  for (const match of headCode.matchAll(PAIRED_TAG_PATTERN)) {
    const tagName = match[1]?.toLowerCase() as PublicHeadCodeTagName | undefined;

    if (!tagName) {
      continue;
    }

    elements.push({
      tagName,
      attributes: parseAttributes(match[2] ?? ''),
      innerHTML: match[3] ?? '',
      index: match.index ?? 0,
    });
  }
}

function collectVoidTags(headCode: string, elements: MatchedHeadTag[]) {
  for (const match of headCode.matchAll(VOID_TAG_PATTERN)) {
    const tagName = match[1]?.toLowerCase() as PublicHeadCodeTagName | undefined;

    if (!tagName) {
      continue;
    }

    elements.push({
      tagName,
      attributes: parseAttributes(match[2] ?? ''),
      innerHTML: null,
      index: match.index ?? 0,
    });
  }
}

function parseAttributes(source: string) {
  const attributes: Record<string, string | boolean> = {};

  for (const match of source.matchAll(ATTRIBUTE_PATTERN)) {
    const rawName = match[1];

    if (!rawName || /^on/i.test(rawName)) {
      continue;
    }

    const normalizedName = ATTRIBUTE_NAME_MAP[rawName.toLowerCase()] ?? rawName;
    attributes[normalizedName] = match[2] ?? match[3] ?? match[4] ?? true;
  }

  return attributes;
}
