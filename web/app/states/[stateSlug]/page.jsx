import { notFound } from "next/navigation";
import { SiteShell } from "../../../components/site-shell.jsx";
import { buildLocationHref, fetchPublicLocationsByState } from "../../../lib/api.js";
import { getSiteUrl } from "../../../lib/site.js";
import { getStateCodeBySlug, getStateName } from "../../../lib/states.js";
import { StatePageClient } from "./state-page-client.jsx";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const stateCode = getStateCodeBySlug(resolvedParams.stateSlug);

  if (!stateCode) {
    return {
      title: "州页面不存在 | ATMB 美国住宅地址目录"
    };
  }

  const stateName = getStateName(stateCode);
  const title = `${stateName} 美国住宅地址租用 | Anytime Mailbox 私人地址筛选`;
  const description = `浏览 ${stateName} 的 Anytime Mailbox 地址，查看月费、RDI、CMRA 与首次发现时间，快速筛选更适合个人用途的美国住宅地址和真实美国地址。`;

  return {
    title,
    description,
    alternates: {
      canonical: `/states/${resolvedParams.stateSlug}`
    },
    openGraph: {
      title,
      description,
      url: `/states/${resolvedParams.stateSlug}`,
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

export default async function StatePage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const stateCode = getStateCodeBySlug(resolvedParams.stateSlug);

  if (!stateCode) {
    notFound();
  }

  const stateName = getStateName(stateCode);
  const result = await fetchPublicLocationsByState(stateCode);
  const items = result.items || [];
  const selectedRdi = normalizeServerFilter(resolvedSearchParams?.rdi);
  const selectedCmra = normalizeServerFilter(resolvedSearchParams?.cmra);
  const filteredItems = items.filter((item) => {
    const matchesRdi = !selectedRdi || item.rdi === selectedRdi;
    const matchesCmra = !selectedCmra || item.cmra === selectedCmra;
    return matchesRdi && matchesCmra;
  });
  const siteUrl = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${stateName} 美国住宅地址目录`,
    description: `浏览 ${stateName} 的 Anytime Mailbox 地址，快速筛选更适合个人用途的美国住宅地址和真实美国地址。`,
    url: `${siteUrl}/states/${resolvedParams.stateSlug}`,
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
      <StatePageClient
        items={filteredItems}
        stateName={stateName}
        total={result.total}
        allItems={items}
        selectedRdi={selectedRdi}
        selectedCmra={selectedCmra}
      />
      <section className={styles.copySection}>
        <div className={styles.copyInner}>
          <h2 className={styles.copyTitle}>{stateName} 州地址筛选说明</h2>
          <p className={styles.copyText}>
            这个页面收录的是 {stateName} 州的 Anytime Mailbox 地址。你可以结合月费、RDI、CMRA 和首次发现时间，先筛掉明显不符合用途的地址，再进入详情或官网继续确认。
          </p>
          <p className={styles.copyText}>
            如果你的目标是寻找更接近美国住宅地址租用或美国私人地址代收的选项，优先对比 RDI、CMRA 和地址所在地区，通常会更高效。
          </p>
        </div>
      </section>
    </SiteShell>
  );
}

function normalizeServerFilter(value) {
  return typeof value === "string" ? value.trim() : "";
}
