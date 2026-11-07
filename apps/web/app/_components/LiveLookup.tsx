'use client';

import { Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ExtensionVerifyProvider, ExtensionVerifyResult } from '@atmb/shared';

import { isExtensionInstalled, verifyWithExtension } from '../_lib/extension-bridge';
import { EXTENSION_LIVE_LOOKUP_URL } from '../_lib/extension-links';

// 地址行底部的「Smarty / USPS 实时查询」：通过浏览器扩展在新标签页打开官方查询页并把结果带回来，
// 与扩展在 ATMB / iPostal1 页面数据卡片里的实时查询是同一条链路；没装扩展就跳到扩展介绍页
interface LiveLookupProps {
  street: string;
  city: string;
  state: string;
  postalCode: string;
}

const PROVIDERS: Array<{ provider: ExtensionVerifyProvider; label: string; title: string; pending: string }> = [
  { provider: 'smarty', label: 'Smarty 实时查询', title: 'Smarty', pending: 'Smarty 查询中…' },
  { provider: 'usps', label: 'USPS 实时查询', title: 'USPS', pending: 'USPS 查询中…（已在新标签页自动填写并查询）' },
];

type Slot = { status: 'pending' } | { status: 'done'; result: ExtensionVerifyResult };

export function LiveLookup({ street, city, state, postalCode }: LiveLookupProps) {
  const [slots, setSlots] = useState<Partial<Record<ExtensionVerifyProvider, Slot>>>({});
  // 服务端不知道浏览器有没有装扩展，挂载后再判断，避免水合不一致
  const [installed, setInstalled] = useState(true);

  useEffect(() => {
    setInstalled(isExtensionInstalled());
  }, []);

  async function run(provider: ExtensionVerifyProvider) {
    if (slots[provider]?.status === 'pending') return;
    if (!isExtensionInstalled()) {
      window.location.assign(EXTENSION_LIVE_LOOKUP_URL);
      return;
    }
    setSlots((current) => ({ ...current, [provider]: { status: 'pending' } }));
    const result = await verifyWithExtension(provider, { street, city, state, postalCode });
    setSlots((current) => ({ ...current, [provider]: { status: 'done', result } }));
  }

  return (
    <div className="addresses-live">
      <div className="addresses-live-actions">
        <Zap size={13} aria-hidden="true" />
        {PROVIDERS.map(({ provider, label }) => (
          <button
            key={provider}
            type="button"
            disabled={slots[provider]?.status === 'pending'}
            title={`通过 usaddres 浏览器扩展在新标签页打开 ${label.replace(' 实时查询', '')} 官方查询页，把结果带回这里`}
            onClick={() => void run(provider)}
          >
            {label}
          </button>
        ))}
        {!installed ? <a href={EXTENSION_LIVE_LOOKUP_URL}>需先安装浏览器扩展</a> : null}
      </div>
      {PROVIDERS.map(({ provider, title, pending }) => {
        const slot = slots[provider];
        if (!slot) return null;
        if (slot.status === 'pending') {
          return (
            <div className="addresses-live-item" key={provider} aria-live="polite">
              <span className="addresses-live-spin" aria-hidden="true" />
              {pending}
            </div>
          );
        }
        const { result } = slot;
        return (
          <div className="addresses-live-item" key={provider} aria-live="polite">
            <strong>{title}</strong>
            {result.ok ? (
              <>
                <span>实时结果</span>
                <div className="addresses-live-addr">{result.address}</div>
                <div className="addresses-live-fields">
                  {(result.fields ?? []).map((field) => (
                    <span className={`addresses-badge ${field.tone}`} key={field.label}>
                      {field.label} {field.value}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <span className="addresses-live-error">{result.error ?? '查询失败'}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
