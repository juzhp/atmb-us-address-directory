import { readFileSync } from 'node:fs';

// 单测在 node 里跑，没有 chrome.i18n：按浏览器的规则（$1…$9 位置替换）用指定语言包顶上
type Messages = Record<string, { message: string }>;

export function loadMessages(locale: string): Messages {
  return JSON.parse(readFileSync(new URL(`../../_locales/${locale}/messages.json`, import.meta.url), 'utf8')) as Messages;
}

export function useLocale(locale: string) {
  const messages = loadMessages(locale);
  (globalThis as { chrome?: unknown }).chrome = {
    i18n: {
      getMessage(key: string, substitutions: string[] = []) {
        const message = messages[key]?.message ?? '';
        return message.replace(/\$(\d)/g, (_match, index: string) => substitutions[Number(index) - 1] ?? '');
      },
    },
  };
}
