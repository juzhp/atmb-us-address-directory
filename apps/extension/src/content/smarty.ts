import { extractSmartyCandidate, oneLineAddress, smartyResultFromCandidate, type VerifyResult } from '../shared/verify.js';
import type { VerifyJobReply } from '../shared/types.js';

// 只在扩展自己为「Smarty 实时查询」打开的标签页里工作：像人一样填好地址、点 View Results，读页面给出的结果
const POLL_MS = 500;
const CLICK_AFTER_MS = 2500;
const GIVE_UP_MS = 30_000;

function send<T>(message: unknown) {
  return new Promise<T | undefined>((resolve) => {
    chrome.runtime.sendMessage(message, (reply: T | undefined) => resolve(chrome.runtime.lastError ? undefined : reply));
  });
}

function report(result: VerifyResult) {
  void send({ type: 'verifyResult', result });
}

// React 受控输入框要走原生 setter 再派发 input 事件才会更新状态
function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  input.focus();
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function readCandidate() {
  return extractSmartyCandidate(document.body.innerText) ?? extractSmartyCandidate(document.querySelector('main')?.textContent ?? '');
}

async function main() {
  const reply = await send<VerifyJobReply>({ type: 'verifyJob' });
  const job = reply?.job;
  if (!job || job.provider !== 'smarty') return;

  const query = oneLineAddress(job.address);
  const startedAt = Date.now();
  let clicked = false;

  const timer = setInterval(() => {
    const candidate = readCandidate();
    if (candidate) {
      clearInterval(timer);
      report(smartyResultFromCandidate(candidate));
      return;
    }

    const elapsed = Date.now() - startedAt;
    if (clicked && /Found 0 valid|No valid address|0 valid address/i.test(document.body.innerText)) {
      clearInterval(timer);
      report({ ok: false, error: 'Smarty 未找到有效地址' });
      return;
    }

    if (!clicked && elapsed > CLICK_AFTER_MS) {
      const input = document.getElementById('us-street-address-entry') as HTMLInputElement | null;
      const button = [...(input?.closest('form')?.querySelectorAll('button') ?? [])].find((item) => item.textContent?.trim() === 'View Results');
      if (input && button) {
        if (!input.value.trim()) typeInto(input, query);
        button.click();
        clicked = true;
      }
    }

    if (elapsed > GIVE_UP_MS) {
      clearInterval(timer);
      report({ ok: false, error: 'Smarty 页面没有返回结果，请稍后重试' });
    }
  }, POLL_MS);
}

void main();
