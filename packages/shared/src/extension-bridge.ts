// 网站页面与浏览器扩展之间的约定：扩展在 usaddres.com 上注入的桥接脚本用 window.postMessage 与页面通信，
// 页面据此发起 Smarty / USPS 实时查询并收回结果。扩展与网站两边都从这里取类型，改协议只改这一处。

export type ExtensionVerifyProvider = 'smarty' | 'usps';

export interface ExtensionVerifyAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
}

export type ExtensionVerifyTone = 'good' | 'warn' | 'muted' | 'info';

export interface ExtensionVerifyField {
  label: string;
  value: string;
  tone: ExtensionVerifyTone;
}

export interface ExtensionVerifyResult {
  ok: boolean;
  error?: string;
  // 对方标准化后的地址
  address?: string;
  fields?: ExtensionVerifyField[];
}

// 扩展装好后，桥接脚本在 <html> 上打的标记，值为扩展版本号；页面用它判断扩展是否已安装
export const EXTENSION_BRIDGE_ATTR = 'data-usaddres-extension';

export const EXTENSION_PAGE_MESSAGE_SOURCE = 'usaddres-page';
export const EXTENSION_BRIDGE_MESSAGE_SOURCE = 'usaddres-extension';

// 页面 → 扩展
export interface ExtensionPageVerifyMessage {
  source: typeof EXTENSION_PAGE_MESSAGE_SOURCE;
  type: 'verify';
  requestId: string;
  provider: ExtensionVerifyProvider;
  address: ExtensionVerifyAddress;
}

// 扩展 → 页面
export interface ExtensionBridgeResultMessage {
  source: typeof EXTENSION_BRIDGE_MESSAGE_SOURCE;
  type: 'verifyResult';
  requestId: string;
  provider: ExtensionVerifyProvider;
  result: ExtensionVerifyResult;
}
