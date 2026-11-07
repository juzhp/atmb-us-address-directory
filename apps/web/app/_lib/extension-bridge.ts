import {
  EXTENSION_BRIDGE_ATTR,
  EXTENSION_BRIDGE_MESSAGE_SOURCE,
  EXTENSION_PAGE_MESSAGE_SOURCE,
  type ExtensionBridgeResultMessage,
  type ExtensionPageVerifyMessage,
  type ExtensionVerifyAddress,
  type ExtensionVerifyProvider,
  type ExtensionVerifyResult,
} from '@atmb/shared';

// 浏览器里与扩展桥接脚本通信（只在客户端调用）。
// 扩展在 usaddres.com 上会给 <html> 打标记，并把页面 postMessage 的查询请求转交后台，结果再 postMessage 回来。

export function isExtensionInstalled() {
  return document.documentElement.hasAttribute(EXTENSION_BRIDGE_ATTR);
}

// Smarty 在后台标签页自动查，很快；USPS 查询页可能要用户手动点 Find，给足时间
const VERIFY_TIMEOUT_MS: Record<ExtensionVerifyProvider, number> = { smarty: 45_000, usps: 5 * 60_000 };
const TIMEOUT_ERROR: Record<ExtensionVerifyProvider, string> = {
  smarty: 'Smarty 查询超时，请稍后重试',
  usps: '等待超时，请重新点击 USPS 实时查询',
};

let requestCounter = 0;

export function verifyWithExtension(provider: ExtensionVerifyProvider, address: ExtensionVerifyAddress) {
  return new Promise<ExtensionVerifyResult>((resolve) => {
    requestCounter += 1;
    const requestId = `${Date.now()}-${requestCounter}`;

    const settle = (result: ExtensionVerifyResult) => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(result);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const message = event.data as Partial<ExtensionBridgeResultMessage> | null;
      if (message?.source !== EXTENSION_BRIDGE_MESSAGE_SOURCE || message.type !== 'verifyResult' || message.requestId !== requestId || !message.result) return;
      settle(message.result);
    };
    const timer = setTimeout(() => settle({ ok: false, error: TIMEOUT_ERROR[provider] }), VERIFY_TIMEOUT_MS[provider]);

    window.addEventListener('message', onMessage);
    const message: ExtensionPageVerifyMessage = { source: EXTENSION_PAGE_MESSAGE_SOURCE, type: 'verify', requestId, provider, address };
    window.postMessage(message, window.location.origin);
  });
}
