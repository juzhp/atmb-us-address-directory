'use client';

import { Menu, X } from 'lucide-react';
import { ReactNode, useState } from 'react';

// 移动端把主导航收起，右上角按钮展开/收起；桌面端按钮隐藏、导航常显（见 globals.css 的 1024px 断点）
export function SiteNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="site-nav-toggle"
        type="button"
        aria-controls="site-nav"
        aria-expanded={open}
        aria-label={open ? '收起导航' : '展开导航'}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
      <nav className={open ? 'site-nav is-open' : 'site-nav'} id="site-nav" aria-label="主导航">
        {children}
      </nav>
    </>
  );
}
