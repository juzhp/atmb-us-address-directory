'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp } from 'lucide-react';

const SHOW_SCROLL_TOP_AT = 420;
const HASH_SCROLL_WAIT_MS = 1600;

export function ScrollBackTop() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      setVisible(window.scrollY > SHOW_SCROLL_TOP_AT);
    };

    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateVisibility);
    };
  }, []);

  useEffect(() => {
    const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const getHashTargetId = (hash: string) => {
      const rawId = hash.replace(/^#/, '');

      if (!rawId) {
        return '';
      }

      try {
        return decodeURIComponent(rawId);
      } catch {
        return rawId;
      }
    };

    const scrollToHash = (hash: string) => {
      const targetId = getHashTargetId(hash);

      if (!targetId) {
        return false;
      }

      const target = document.getElementById(targetId);

      if (!target) {
        return false;
      }

      target.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });

      return true;
    };

    const waitAndScrollToHash = (hash: string) => {
      const startedAt = performance.now();

      const tick = () => {
        if (scrollToHash(hash)) {
          return;
        }

        if (performance.now() - startedAt < HASH_SCROLL_WAIT_MS) {
          requestAnimationFrame(tick);
        }
      };

      requestAnimationFrame(tick);
    };

    const isPlainLeftClick = (event: MouseEvent) =>
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

    const navigateSmoothly = (url: URL) => {
      const href = `${url.pathname}${url.search}${url.hash}`;
      const samePathAndSearch = url.pathname === window.location.pathname && url.search === window.location.search;

      if (samePathAndSearch) {
        window.history.pushState(null, '', href);
        waitAndScrollToHash(url.hash);
        return;
      }

      router.push(href, { scroll: false });
      waitAndScrollToHash(url.hash);
    };

    const handleClick = (event: MouseEvent) => {
      if (!isPlainLeftClick(event)) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest('a[href]');

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);

      if (url.origin !== window.location.origin || !url.hash) {
        return;
      }

      event.preventDefault();
      navigateSmoothly(url);
    };

    const handleSubmit = (event: Event) => {
      const form = event.target;

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      if ((form.method || 'get').toLowerCase() !== 'get' || (form.target && form.target !== '_self')) {
        return;
      }

      const url = new URL(form.action || window.location.href, window.location.href);

      if (url.origin !== window.location.origin || !url.hash) {
        return;
      }

      const params = new URLSearchParams();

      new FormData(form).forEach((value, key) => {
        if (typeof value === 'string' && value !== '') {
          params.append(key, value);
        }
      });

      url.search = params.toString();
      event.preventDefault();
      navigateSmoothly(url);
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('submit', handleSubmit, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('submit', handleSubmit, true);
    };
  }, [router]);

  const handleBackTop = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <button
      aria-label="返回顶部"
      className={visible ? 'scroll-back-top is-visible' : 'scroll-back-top'}
      onClick={handleBackTop}
      tabIndex={visible ? 0 : -1}
      title="返回顶部"
      type="button"
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
}
