import { SiteShell } from "../../components/site-shell.jsx";
import { buildLocationHref, fetchAllPublicLocations } from "../../lib/api.js";
import { getSiteUrl } from "../../lib/site.js";
import { ResidentialPageClient } from "./residential-page-client.jsx";
import styles from "../states/[stateSlug]/page.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const selectedQuery = normalizeServerFilter(resolvedSearchParams?.q);
  const selectedCmra = normalizeServerFilter(resolvedSearchParams?.cmra);
  const hasFilters = Boolean(selectedQuery || selectedCmra);
  const title = "查询美国住宅地址 | Residential 地址筛选";
  const description =
    "集中查询 RDI 为 Residential 的 Anytime Mailbox 地址，支持按关键词和 CMRA 筛选，更快找到更接近住宅用途的美国地址。";

  return {
    title,
    description,
    alternates: {
      canonical: "/residential-addresses"
    },
    robots: hasFilters
      ? {
          index: false,
          follow: true
        }
      : undefined,
    openGraph: {
      title,
      description,
      url: "/residential-addresses",
      siteName: "ATMB 美国住宅地址目录",
      locale: "zh_CN",
      type: "website"
    },
    twitter: {
      card: "summary",
      title,
      description
    }
  };
}

export default async function ResidentialAddressesPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const selectedQuery = normalizeServerFilter(resolvedSearchParams?.q);
  const selectedCmra = normalizeServerFilter(resolvedSearchParams?.cmra);
  const allItems = await fetchAllPublicLocations({ rdi: "Residential" });
  const filteredItems = allItems.filter((item) => {
    const matchesQuery = matchesKeyword(item, selectedQuery);
    const matchesCmra = !selectedCmra || item.cmra === selectedCmra;
    return matchesQuery && matchesCmra;
  });
  const siteUrl = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "查询美国住宅地址",
    description:
      "集中查询 RDI 为 Residential 的 Anytime Mailbox 地址，支持按关键词和 CMRA 筛选。",
    url: `${siteUrl}/residential-addresses`,
    isPartOf: {
      "@type": "WebSite",
      name: "ATMB 美国住宅地址目录",
      url: siteUrl
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: filteredItems.length,
      itemListElement: filteredItems.slice(0, 20).map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}${buildLocationHref(item)}`,
        name: item.full_address
      }))
    }
  };

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ResidentialPageClient
        items={filteredItems}
        total={allItems.length}
        selectedQuery={selectedQuery}
        selectedCmra={selectedCmra}
      />
      <section className={styles.copySection}>
        <div className={styles.copyInner}>
          <h2 className={styles.copyTitle}>住宅地址查询说明</h2>
          <p className={styles.copyText}>
            这个页面默认只展示 `RDI = Residential` 的地址，适合优先筛选更接近住宅用途的美国地址。
          </p>
          <p className={styles.copyText}>
            你可以先用关键词搜索城市、地址或名称，再结合 CMRA 状态缩小范围，然后进入详情页继续比较编号范围和来源链接。
          </p>
        </div>
      </section>
    </SiteShell>
  );
}

function normalizeServerFilter(value) {
  return typeof value === "string" ? value.trim() : "";
}

function matchesKeyword(item, query) {
  if (!query) {
    return true;
  }

  const haystack = [item.location_name, item.full_address, item.city, item.state]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}
