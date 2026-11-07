import {
  EXTENSION_BRIDGE_ATTR,
  EXTENSION_BRIDGE_MESSAGE_SOURCE,
  EXTENSION_PAGE_MESSAGE_SOURCE,
  type ExtensionBridgeResultMessage,
  type ExtensionPageVerifyMessage,
  type ExtensionVerifyProvider,
  type ExtensionVerifyResult,
} from '@atmb/shared';

import type { VerifyPush, VerifyStartReply } from '../shared/types.js';

// 只在 usaddres.com 上运行的桥接脚本：给页面打上「扩展已安装」的标记，
// 把页面发起的 Smarty / USPS 实时查询转交给后台（与 ATMB / iPostal1 页面上的数据卡片走同一条链路），结果再送回页面。
document.documentElement.setAttribute(EXTENSION_BRIDGE_ATTR, chrome.runtime.getManifest().version);

function postResult(requestId: string, provider: ExtensionVerifyProvider, result: ExtensionVerifyResult) {
  const message: ExtensionBridgeResultMessage = { source: EXTENSION_BRIDGE_MESSAGE_SOURCE, type: 'verifyResult', requestId, provider, result };
  window.postMessage(message, location.origin);
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const message = event.data as Partial<ExtensionPageVerifyMessage> | null;
  if (message?.source !== EXTENSION_PAGE_MESSAGE_SOURCE || message.type !== 'verify' || !message.requestId || !message.provider || !message.address) return;
  const { requestId, provider, address } = message;
  chrome.runtime.sendMessage({ type: 'verify', provider, address, requestId }, (reply: VerifyStartReply | undefined) => {
    const error = chrome.runtime.lastError?.message ?? (reply?.started ? null : (reply?.error ?? '无法打开查询页面'));
    if (error) postResult(requestId, provider, { ok: false, error });
  });
});

chrome.runtime.onMessage.addListener((message: VerifyPush) => {
  if (message?.type === 'verifyResult') {
    postResult(message.requestId, message.provider, message.result);
  }
});
