import Link from "next/link";
import styles from "../components/public-home.module.css";
import { SiteShell } from "../components/site-shell.jsx";
import { fetchPublicStats, fetchRecentStates, fetchStates } from "../lib/api.js";
import { getSiteUrl } from "../lib/site.js";
import { enrichStates } from "../lib/states.js";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ATMB 美国住宅地址目录 | 快速筛选 Anytime Mailbox 私人地址",
  description:
    "收录 Anytime Mailbox 美国地址，支持按州浏览，帮助你快速找到更适合租用的美国住宅地址、美国私人地址与真实美国地址。",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "ATMB 美国住宅地址目录 | 快速筛选 Anytime Mailbox 私人地址",
    description:
      "收录 Anytime Mailbox 美国地址，帮助你快速筛选更适合租用的美国住宅地址、美国私人地址与真实美国地址。",
    url: "/",
    siteName: "ATMB 美国住宅地址目录",
    locale: "zh_CN",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "ATMB 美国住宅地址目录 | 快速筛选 Anytime Mailbox 私人地址",
    description:
      "收录 Anytime Mailbox 美国地址，帮助你快速筛选更适合租用的美国住宅地址、美国私人地址与真实美国地址。"
  }
};

export default async function HomePage() {
  const [stats, rawStates, rawRecentStates] = await Promise.all([
    fetchPublicStats(),
    fetchStates(),
    fetchRecentStates(20)
  ]);
  const states = enrichStates(rawStates).sort((left, right) => left.name.localeCompare(right.name));
  const popularStates = [...states].sort((left, right) => right.count - left.count).slice(0, 10);
  const recentStates = enrichStates(rawRecentStates);
  const siteUrl = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ATMB 美国住宅地址目录",
    url: siteUrl,
    description:
      "帮助你快速筛选 Anytime Mailbox 美国住宅地址、美国私人地址与真实美国地址。",
    inLanguage: "zh-CN"
  };

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className={styles.page}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>Anytime Mailbox 美国住宅地址筛选</p>
          <h1 className={styles.title}>快速找到心仪的美国住宅地址租用</h1>
          <p className={styles.lede}>
            本站整理 Anytime Mailbox 在美国的地址目录，帮助你按州快速筛选更适合租用的美国住宅地址、美国私人地址与真实美国地址。
            当前共收录 {stats.activeLocations} 条有效地址。
          </p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>按州浏览</h2>
            <div className={styles.sectionMeta}>{states.length} 个州级入口</div>
          </div>
          {states.length > 0 ? (
            <div className={styles.statesGrid}>
              {states.map((item) => (
                <Link key={item.state} href={`/states/${item.slug}`} className={styles.stateLink}>
                  <div>
                    <div className={styles.stateName}>{item.name}</div>
                    <div className={styles.stateCode}>{item.state}</div>
                  </div>
                  <div className={styles.stateMetrics}>
                    <div className={styles.stateCount}>{item.count} 条</div>
                    <div className={styles.stateResidential}>R: {item.residentialCount ?? 0}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>当前还没有州级数据。</div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>热门州</h2>
            <div className={styles.sectionMeta}>地址数量最多的前 10 个州</div>
          </div>
          {popularStates.length > 0 ? (
            <div className={styles.popularList}>
              {popularStates.map((item, index) => (
                <Link key={item.state} href={`/states/${item.slug}`} className={styles.popularItem}>
                  <div className={styles.rank}>{String(index + 1).padStart(2, "0")}</div>
                  <div>
                    <div className={styles.popularName}>{item.name}</div>
                    <div className={styles.popularMeta}>{item.state}</div>
                  </div>
                  <div className={styles.popularCount}>{item.count}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>当前还没有热门州数据。</div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>最新入库州分布</h2>
            <div className={styles.sectionMeta}>按最近入库日期统计的州分布</div>
          </div>
          {recentStates.length > 0 ? (
            <div className={styles.recentList}>
              {recentStates.map((item) => (
                <Link
                  key={`recent-${item.state}`}
                  href={`/states/${item.slug}`}
                  className={styles.recentItem}
                >
                  <div>
                    <div className={styles.recentName}>{item.name}</div>
                    <div className={styles.recentMeta}>{item.state}</div>
                  </div>
                  <div className={styles.recentCount}>{item.count}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>当前没有可展示的最新入库州分布。</div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>如何使用这个站点</h2>
          </div>
          <div className={styles.copyBlock}>
            <p>
              如果你正在挑选 Anytime Mailbox 的美国私人地址，本目录可以先按州快速缩小范围，再进入州页查看月费、RDI、CMRA 和最小编号。
            </p>
            <p>
              这种方式比逐个地址手动打开官网更高效，适合先筛出更接近住宅用途或个人用途的地址，再继续进入官网确认细节。
            </p>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
