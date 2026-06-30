export default function ResidentialAddressesLoading() {
  return (
    <main className="site-main addresses-page">
      <div
        className="addresses-inner addresses-skeleton"
        aria-busy="true"
        aria-live="polite"
        style={{ paddingTop: 48, paddingBottom: 48 }}
      >
        <span className="home-visually-hidden">正在加载住宅地址列表…</span>
        {Array.from({ length: 8 }).map((_, index) => (
          <span className="addresses-skeleton-row" key={index} aria-hidden="true" />
        ))}
      </div>
    </main>
  );
}
