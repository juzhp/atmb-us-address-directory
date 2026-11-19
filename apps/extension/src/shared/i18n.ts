import type messages from '../../_locales/zh_CN/messages.json';

// 界面文字都放在 _locales/<语言>/messages.json，由浏览器按界面语言挑选；简体中文是默认语言（没覆盖到的语言也显示它），键以它为准
export type MessageKey = keyof typeof messages;

export function t(key: MessageKey, ...substitutions: Array<string | number>) {
  return chrome.i18n.getMessage(key, substitutions.map(String)) || key;
}
