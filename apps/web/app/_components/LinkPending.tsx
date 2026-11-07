'use client';

import { useLinkStatus } from 'next/link';

// 放在 next/link 内部：目标页还在服务端渲染时显示一个小转圈，让点击有即时反馈
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="link-pending" aria-hidden="true" /> : null;
}
