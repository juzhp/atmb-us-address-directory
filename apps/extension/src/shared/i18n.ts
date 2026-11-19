import type messages from '../../_locales/en/messages.json';

// 界面文字都放在 _locales/<语言>/messages.json，由浏览器按界面语言挑选；英文是默认语言，键以它为准
export type MessageKey = keyof typeof messages;

export function t(key: MessageKey, ...substitutions: Array<string | number>) {
  return chrome.i18n.getMessage(key, substitutions.map(String)) || key;
}
