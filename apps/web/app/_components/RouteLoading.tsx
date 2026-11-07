import { SiteFooter, SiteHeader, type SiteNavKey } from './SiteShell';

// 列表页的路由级加载骨架：点击导航后立即显示，等服务端渲染完成再换成真实内容
export function RouteLoading({ active }: { active: SiteNavKey }) {
  return (
    <>
      <SiteHeader active={active} />
      <main className="site-main addresses-page route-loading" role="status" aria-busy="true" aria-live="polite">
        <span className="home-visually-hidden">正在加载页面…</span>
        <section className="addresses-hero">
          <div className="addresses-inner">
            <div className="route-loading-bar" style={{ width: '18%', height: 14 }} />
            <div className="route-loading-bar" style={{ width: '46%', height: 38, marginTop: 24 }} />
            <div className="route-loading-bar" style={{ width: '62%', height: 16, marginTop: 18 }} />
            <div className="route-loading-bar" style={{ width: '52%', height: 16, marginTop: 10 }} />
          </div>
        </section>
        <section className="addresses-inner route-loading-panel">
          <div className="route-loading-bar" style={{ height: 46 }} />
          <div className="route-loading-bar" style={{ height: 46 }} />
          <div className="route-loading-bar" style={{ height: 46 }} />
          <div className="route-loading-bar" style={{ height: 46 }} />
        </section>
        <section className="addresses-inner route-loading-list">
          <div className="route-loading-bar" style={{ height: 72 }} />
          <div className="route-loading-bar" style={{ height: 72 }} />
          <div className="route-loading-bar" style={{ height: 72 }} />
          <div className="route-loading-bar" style={{ height: 72 }} />
          <div className="route-loading-bar" style={{ height: 72 }} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
