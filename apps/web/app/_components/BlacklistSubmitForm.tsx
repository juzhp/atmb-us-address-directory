'use client';

import { BLACKLIST_REASON_MAX_LENGTH, parseOneLineUsAddress, US_STATES } from '@atmb/shared';
import { CheckCircle2, Send, Wand2 } from 'lucide-react';
import { FormEvent, useState, useTransition } from 'react';

import { PUBLIC_API_BASE_URL } from '../lib/api';

const emptyForm = {
  oneLine: '',
  streetAddress: '',
  city: '',
  state: '',
  postalCode: '',
  reason: '',
  sourceUrl: '',
  website: '',
};

export function BlacklistSubmitForm() {
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function setValue<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function parseOneLine() {
    const parsed = parseOneLineUsAddress(form.oneLine);
    setForm((current) => ({
      ...current,
      streetAddress: parsed.streetAddress || current.streetAddress,
      city: parsed.city || current.city,
      state: parsed.state || current.state,
      postalCode: parsed.postalCode || current.postalCode,
    }));
    setMessage(parsed.postalCode ? '' : '没有识别出 ZIP，请检查地址格式，例如：123 Main St, Los Angeles, CA 90001');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/public/blacklist/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streetAddress: form.streetAddress,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          reason: form.reason,
          sourceUrl: form.sourceUrl,
          website: form.website,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setMessage(body?.message ?? '提交失败，请稍后再试');
        return;
      }

      setSubmitted(true);
      setForm(emptyForm);
    });
  }

  if (submitted) {
    return (
      <div className="blacklist-form-success" role="status">
        <CheckCircle2 size={22} aria-hidden="true" />
        <div>
          <strong>已收到你的反馈</strong>
          <p>确认后该地址会出现在黑名单列表中，感谢分享。</p>
          <button type="button" onClick={() => setSubmitted(false)}>再提交一条</button>
        </div>
      </div>
    );
  }

  return (
    <form className="blacklist-form" onSubmit={submit}>
      <label className="blacklist-form-wide">
        <span>整行地址（可选，粘贴后一键解析）</span>
        <div className="blacklist-parse-row">
          <input
            value={form.oneLine}
            onChange={(event) => setValue('oneLine', event.target.value)}
            placeholder="例如：123 Main St, Suite 5, Los Angeles, CA 90001"
          />
          <button type="button" onClick={parseOneLine} disabled={!form.oneLine.trim()}>
            <Wand2 size={16} aria-hidden="true" />
            一键解析
          </button>
        </div>
      </label>
      <label className="blacklist-form-wide">
        <span>街道地址 *</span>
        <input
          required
          minLength={3}
          maxLength={160}
          value={form.streetAddress}
          onChange={(event) => setValue('streetAddress', event.target.value)}
          placeholder="123 Main St, Suite 5"
        />
      </label>
      <label>
        <span>城市 *</span>
        <input
          required
          maxLength={80}
          value={form.city}
          onChange={(event) => setValue('city', event.target.value)}
          placeholder="Los Angeles"
        />
      </label>
      <label>
        <span>州 *</span>
        <select required value={form.state} onChange={(event) => setValue('state', event.target.value)}>
          <option value="">选择州</option>
          {US_STATES.map((state) => (
            <option key={state.code} value={state.code}>{state.label}</option>
          ))}
        </select>
      </label>
      <label>
        <span>邮编 ZIP *</span>
        <input
          required
          inputMode="numeric"
          pattern="\d{5}(-\d{4})?"
          value={form.postalCode}
          onChange={(event) => setValue('postalCode', event.target.value)}
          placeholder="90001"
        />
      </label>
      <label className="blacklist-form-wide">
        <span>遇到的问题 *</span>
        <textarea
          required
          rows={4}
          maxLength={BLACKLIST_REASON_MAX_LENGTH}
          value={form.reason}
          onChange={(event) => setValue('reason', event.target.value)}
          placeholder="例如：申请信用卡时地址被拒；房东不配合办理 1583 公证；邮件长时间不处理或丢失；有事先没说明的费用"
        />
        <small className={form.reason.length >= BLACKLIST_REASON_MAX_LENGTH ? 'blacklist-counter limit' : 'blacklist-counter'}>
          {form.reason.length}/{BLACKLIST_REASON_MAX_LENGTH}
        </small>
      </label>
      <label className="blacklist-form-wide">
        <span>来源链接（可选）</span>
        <input
          type="url"
          maxLength={500}
          value={form.sourceUrl}
          onChange={(event) => setValue('sourceUrl', event.target.value)}
          placeholder="https://… 帖子、截图或公告链接"
        />
      </label>
      <div className="blacklist-honeypot" aria-hidden="true">
        <label>
          Website
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(event) => setValue('website', event.target.value)}
          />
        </label>
      </div>
      {message ? <p className="blacklist-form-message" role="alert">{message}</p> : null}
      <div className="blacklist-form-actions">
        <button className="primary" disabled={isPending} type="submit">
          <Send size={16} aria-hidden="true" />
          {isPending ? '提交中…' : '提交问题地址'}
        </button>
      </div>
    </form>
  );
}
