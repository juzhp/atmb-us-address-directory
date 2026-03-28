import Link from "next/link";
import styles from "./page.module.css";
import { SiteShell } from "../../components/site-shell.jsx";
import { buildLocationHref, fetchPublicLocations, fetchStates } from "../../lib/api.js";

export const metadata = {
  title: "地址列表 | ATMB 地址目录",
  description: "按州和关键词搜索有效的美国虚拟邮箱地址。"
};

export const dynamic = "force-dynamic";

export default async function LocationsPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams?.page || 1);
  const state = resolvedSearchParams?.state || "";
  const q = resolvedSearchParams?.q || "";

  const [locations, states] = await Promise.all([
    fetchPublicLocations({ page, limit: 24, state, q }),
    fetchStates()
  ]);

  return (
    <SiteShell>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <form action="/locations" method="get">
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="q">
                关键词
              </label>
              <input id="q" name="q" defaultValue={q} className={styles.field} />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="state">
                州
              </label>
              <select id="state" name="state" defaultValue={state} className={styles.field}>
                <option value="">全部州</option>
                {states.map((item) => (
                  <option key={item.state} value={item.state}>
                    {item.state}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={styles.submit}>
              应用筛选
            </button>
          </form>
        </aside>

        <section className={styles.results}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>有效地址</h1>
              <div className={styles.meta}>共 {locations.total} 条记录</div>
            </div>
          </div>

          <div className={styles.grid}>
            {locations.items.map((location) => (
              <Link
                key={location.id}
                href={buildLocationHref(location)}
                className={styles.card}
              >
                <h2 className={styles.cardTitle}>{location.location_name}</h2>
                <div className={styles.cardText}>{location.full_address}</div>
                <div className={styles.chips}>
                  {location.monthly_price ? (
                    <span className={styles.chip}>${location.monthly_price}/月</span>
                  ) : null}
                  {location.rdi ? <span className={styles.chip}>{location.rdi}</span> : null}
                  {location.cmra ? <span className={styles.chip}>CMRA {location.cmra}</span> : null}
                  {location.personalize_min && location.personalize_max ? (
                    <span className={styles.chip}>
                      #{location.personalize_min} - #{location.personalize_max}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
