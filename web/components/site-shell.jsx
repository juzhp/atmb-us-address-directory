import Link from "next/link";
import { BrandMark } from "./brand-mark.jsx";
import styles from "./site-shell.module.css";

const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com";
const residentialUrl = "https://tinyurl.com/3cnevxjv";

const defaultPublicNavLinks = [
  { href: "/", label: "首页" },
  { href: "/residential-addresses", label: "查询住宅地址" },
  { href: residentialUrl, label: "获得美国住宅地址", external: true, hot: true }
];

const defaultFooterLinks = [
  { href: "/", label: "首页" },
  { href: "/residential-addresses", label: "查询住宅地址" }
];

export function SiteShell({
  children,
  rightSlot = null,
  navLinks = [],
  footerLinks = defaultFooterLinks
}) {
  const resolvedNavLinks = navLinks.length > 0 ? navLinks : defaultPublicNavLinks;
  const showRightRailResidentialLink = navLinks.length > 0;

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <div className={styles.leftRail}>
          <Link href="/" className={styles.brand}>
            <BrandMark className={styles.brandMark} />
          </Link>
          {resolvedNavLinks.length > 0 ? (
            <nav className={styles.navLinks} aria-label="Primary">
              {resolvedNavLinks.map((item) => renderNavLink(item))}
            </nav>
          ) : null}
        </div>

        <div className={styles.rightRail}>
          {showRightRailResidentialLink ? (
            <a
              href={residentialUrl}
              target="_blank"
              rel="noreferrer noopener nofollow"
              className={`${styles.navLink} ${styles.navLinkHot}`}
            >
              <span>获得美国住宅地址</span>
              <span className={styles.hotBadge}>热门</span>
            </a>
          ) : null}
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={styles.iconLink}
            aria-label="GitHub"
            title="GitHub"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.8.5 12.35c0 5.24 3.3 9.68 7.88 11.25.58.11.79-.26.79-.58 0-.29-.01-1.23-.02-2.23-3.2.71-3.88-1.39-3.88-1.39-.52-1.37-1.28-1.74-1.28-1.74-1.05-.74.08-.72.08-.72 1.16.08 1.76 1.23 1.76 1.23 1.03 1.82 2.71 1.29 3.37.99.11-.77.4-1.29.72-1.59-2.55-.3-5.22-1.31-5.22-5.84 0-1.29.45-2.35 1.19-3.18-.12-.3-.52-1.51.11-3.14 0 0 .97-.32 3.18 1.21a10.7 10.7 0 0 1 5.78 0c2.21-1.53 3.17-1.21 3.17-1.21.63 1.63.23 2.84.11 3.14.74.83 1.19 1.89 1.19 3.18 0 4.54-2.67 5.54-5.23 5.84.41.37.77 1.09.77 2.2 0 1.59-.01 2.86-.01 3.25 0 .32.21.7.8.58 4.57-1.57 7.86-6.01 7.86-11.25C23.5 5.8 18.35.5 12 .5Z" />
            </svg>
          </a>
          {rightSlot}
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <div className={styles.footerBrand}>
            <BrandMark className={styles.footerBrandMark} />
          </div>
          <div className={styles.footerText}>
            帮助你更快筛选 Anytime Mailbox 美国住宅地址、美国私人地址与真实美国地址。
          </div>
        </div>
        <div className={styles.footerRight}>
          <div className={styles.footerLinks}>
            {footerLinks.map((item) => renderFooterLink(item))}
          </div>
          <div className={styles.footerUtilities}>
            <a
              href={residentialUrl}
              target="_blank"
              rel="noreferrer noopener nofollow"
              className={`${styles.footerLink} ${styles.footerHotLink}`}
            >
              <span>获得美国住宅地址</span>
              <span className={styles.hotBadge}>热门</span>
            </a>
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={styles.footerIconLink}
              aria-label="GitHub"
              title="GitHub"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.8.5 12.35c0 5.24 3.3 9.68 7.88 11.25.58.11.79-.26.79-.58 0-.29-.01-1.23-.02-2.23-3.2.71-3.88-1.39-3.88-1.39-.52-1.37-1.28-1.74-1.28-1.74-1.05-.74.08-.72.08-.72 1.16.08 1.76 1.23 1.76 1.23 1.03 1.82 2.71 1.29 3.37.99.11-.77.4-1.29.72-1.59-2.55-.3-5.22-1.31-5.22-5.84 0-1.29.45-2.35 1.19-3.18-.12-.3-.52-1.51.11-3.14 0 0 .97-.32 3.18 1.21a10.7 10.7 0 0 1 5.78 0c2.21-1.53 3.17-1.21 3.17-1.21.63 1.63.23 2.84.11 3.14.74.83 1.19 1.89 1.19 3.18 0 4.54-2.67 5.54-5.23 5.84.41.37.77 1.09.77 2.2 0 1.59-.01 2.86-.01 3.25 0 .32.21.7.8.58 4.57-1.57 7.86-6.01 7.86-11.25C23.5 5.8 18.35.5 12 .5Z" />
            </svg>
          </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function renderNavLink(item) {
  if (item.external) {
    return (
      <a
        key={item.href}
        href={item.href}
        target="_blank"
        rel="noreferrer noopener nofollow"
        className={`${styles.navLink} ${item.hot ? styles.navLinkHot : ""}`}
      >
        <span>{item.label}</span>
        {item.hot ? <span className={styles.hotBadge}>热门</span> : null}
      </a>
    );
  }

  return (
    <Link
      key={item.href}
      href={item.href}
      className={`${styles.navLink} ${item.hot ? styles.navLinkHot : ""}`}
    >
      <span>{item.label}</span>
      {item.hot ? <span className={styles.hotBadge}>热门</span> : null}
    </Link>
  );
}

function renderFooterLink(item) {
  if (item.external) {
    return (
      <a
        key={item.href}
        href={item.href}
        target="_blank"
        rel="noreferrer noopener nofollow"
        className={styles.footerLink}
      >
        {item.label}
      </a>
    );
  }

  return (
    <Link key={item.href} href={item.href} className={styles.footerLink}>
      {item.label}
    </Link>
  );
}
