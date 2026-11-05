import { uspsResultFromPage, type VerifyAddress, type VerifyResult } from '../shared/verify.js';
import type { VerifyJobReply } from '../shared/types.js';

// 只在扩展为「USPS 实时查询」打开的标签页里工作：把地址填进表单并点 Find，
// 页面出结果后读取并带回原来的数据卡片。走的是页面自己的表单，不直接调接口。
const FORM_WAIT_MS = 20_000;
const CLICK_DELAY_MS = 600;

function send<T>(message: unknown) {
  return new Promise<T | undefined>((resolve) => {
    chrome.runtime.sendMessage(message, (reply: T | undefined) => resolve(chrome.runtime.lastError ? undefined : reply));
  });
}

function report(result: VerifyResult) {
  void send({ type: 'verifyResult', result });
}

function waitFor<T>(read: () => T | null, timeoutMs: number) {
  return new Promise<T | null>((resolve) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const value = read();
      if (value || Date.now() - startedAt > timeoutMs) {
        clearInterval(timer);
        resolve(value);
      }
    }, 300);
  });
}

function fill(id: string, value: string) {
  const field = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (!field || !value) return;
  field.focus();
  field.value = value;
  for (const type of ['input', 'change', 'blur']) {
    field.dispatchEvent(new Event(type, { bubbles: true }));
  }
}

function fillForm(address: VerifyAddress) {
  fill('tAddress', address.street);
  fill('tCity', address.city);
  fill('tState', address.state);
  fill('tZip-byaddress', address.postalCode);
}

function showHint(form: HTMLElement) {
  const hint = document.createElement('div');
  hint.textContent = 'usaddres 正在自动查询这个地址，结果会带回原来的页面。如果没有反应，请手动点击下方的 Find。';
  hint.style.cssText = 'margin:0 0 12px;padding:10px 12px;border:1px solid #68b7c6;border-left:4px solid #057f93;border-radius:4px;background:#eef8fb;color:#071a3f;font:14px/1.5 Arial,"Microsoft YaHei",sans-serif;';
  form.prepend(hint);
}

function readResult(): VerifyResult | null {
  const items = document.querySelectorAll('#zipByAddressDiv li.list-group-item');
  const first = items[0];
  if (!first) return null;
  const lines = [...first.querySelectorAll('.zipcode-result-address p')].map((line) => line.textContent ?? '');
  const details = [...first.querySelectorAll('.row-detail-wrapper p')].map((cell) => cell.textContent ?? '');
  return uspsResultFromPage(lines, details, items.length);
}

function errorShown() {
  const box = document.getElementById('error-by-address');
  return Boolean(box && box.offsetParent !== null && (box.textContent ?? '').trim());
}

async function main() {
  const reply = await send<VerifyJobReply>({ type: 'verifyJob' });
  const job = reply?.job;
  if (!job || job.provider !== 'usps') return;

  const form = await waitFor(() => (document.getElementById('tAddress') ? document.getElementById('zip-code-address-form') : null), FORM_WAIT_MS);
  if (!form) {
    report({ ok: false, error: 'USPS 查询页没有加载出表单，请在该页面手动查询' });
    return;
  }

  // 先挂好监听再提交；自动点没反应时用户手动点 Find，结果同样会被带回去
  let done = false;
  const observer = new MutationObserver(() => {
    if (done) return;
    const result = readResult();
    if (result) {
      done = true;
      observer.disconnect();
      report(result);
    } else if (errorShown()) {
      done = true;
      observer.disconnect();
      report({ ok: false, error: 'USPS 未找到该地址，可在 USPS 页面修改后重新查询' });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

  fillForm(job.address);
  showHint(form);
  setTimeout(() => document.getElementById('zip-by-address')?.click(), CLICK_DELAY_MS);
}

void main();
