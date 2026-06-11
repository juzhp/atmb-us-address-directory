import Link from 'next/link';

type SiteNavKey = 'home' | 'addresses' | 'residential' | 'faq';

function navClass(active: SiteNavKey, key: SiteNavKey) {
  return active === key ? 'site-nav-active' : undefined;
}

export function SiteHeader({ active = 'home' }: { active?: SiteNavKey }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-brand" href="/" aria-label="Anytime Mailbox住宅地址指南首页">
          <span>Anytime Mailbox住宅地址指南</span>
        </Link>
        <nav className="site-nav" aria-label="主导航">
          <Link className={navClass(active, 'home')} href="/">首页</Link>
          <Link className="site-nav-recommend" href="/go/get-us-residential-address">获得美国住宅地址</Link>
          <Link className={navClass(active, 'addresses')} href="/addresses">所有地址</Link>
          <Link className={navClass(active, 'residential')} href="/residential-addresses">住宅地址</Link>
          <Link className={navClass(active, 'faq')} href={active === 'home' ? '#faq' : '/#faq'}>FAQ</Link>
          <a className="site-github-link" href="https://github.com/juzhp/atmb-us-address-directory" rel="noreferrer" target="_blank" aria-label="GitHub">
            <GitHubMark />
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <strong>Anytime Mailbox住宅地址指南</strong>
          <p>
            本站为第三方地址筛选指南，非 Anytime Mailbox 官方网站。所有数据均来自公开信息与第三方服务，仅供参考与研究使用，
            不构成任何承诺、保证或租用建议。
          </p>
        </div>
        <nav aria-label="页脚导航">
          <Link href="/addresses">所有地址</Link>
          <Link href="/residential-addresses">住宅地址</Link>
          <Link href="/#faq">FAQ</Link>
        </nav>
      </div>
    </footer>
  );
}

function GitHubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.5 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.38-3.37-1.38-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .08 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.93.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.93c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .28.18.6.69.5A10.09 10.09 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}
