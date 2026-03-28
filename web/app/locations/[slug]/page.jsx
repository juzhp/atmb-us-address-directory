import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { DetailActions } from "./detail-actions.jsx";
import { SiteShell } from "../../../components/site-shell.jsx";
import { extractIdFromSlug, fetchPublicLocation } from "../../../lib/api.js";
import { getSiteUrl } from "../../../lib/site.js";
import { getStateName, getStateSlug } from "../../../lib/states.js";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const id = extractIdFromSlug(resolvedParams.slug);
  const location = Number.isInteger(id) ? await fetchPublicLocation(id) : null;

  if (!location) {
    return {
      title: "地址不存在 | ATMB 美国住宅地址目录"
    };
  }

  const title = `${location.full_address} | 美国私人地址与住宅地址详情`;
  const description = `查看 ${location.full_address} 的 Anytime Mailbox 地址详情，包括月费、RDI、CMRA、编号范围与官网入口，辅助筛选更适合租用的美国私人地址。`;

  return {
    title,
    description,
    alternates: {
      canonical: `/locations/${resolvedParams.slug}`
    },
    openGraph: {
      title,
      description,
      url: `/locations/${resolvedParams.slug}`,
      siteName: "ATMB 美国住宅地址目录",
      locale: "zh_CN",
      type: "article"
    },
    twitter: {
      card: "summary",
      title,
      description
    }
  };
}

export default async function LocationDetailPage({ params }) {
  const resolvedParams = await params;
  const id = extractIdFromSlug(resolvedParams.slug);
  const location = Number.isInteger(id) ? await fetchPublicLocation(id) : null;

  if (!location) {
    notFound();
  }

  const mapUrl = buildMapUrl(location.full_address);
  const stateSlug = location.state ? getStateSlug(location.state) : "";
  const stateName = location.state ? getStateName(location.state) : "";
  const stateHref = stateSlug ? `/states/${stateSlug}` : "/locations";
  const siteUrl = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: location.full_address,
    url: `${siteUrl}/locations/${resolvedParams.slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: [location.street, location.street2].filter(Boolean).join(", "),
      addressLocality: location.city || "",
      addressRegion: location.state || "",
      postalCode: location.postal_code || "",
      addressCountry: location.country || "US"
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "RDI", value: location.rdi || "" },
      { "@type": "PropertyValue", name: "CMRA", value: location.cmra || "" },
      {
        "@type": "PropertyValue",
        name: "Monthly Price",
        value: location.monthly_price ? String(location.monthly_price) : ""
      },
      {
        "@type": "PropertyValue",
        name: "Personalize Min",
        value: location.personalize_min ? String(location.personalize_min) : ""
      },
      {
        "@type": "PropertyValue",
        name: "Personalize Max",
        value: location.personalize_max ? String(location.personalize_max) : ""
      }
    ],
    sameAs: location.detail_url || undefined
  };

  const basicFields = [
    ["ID", location.id],
    ["External ID", location.external_id],
    ["完整地址", location.full_address],
    ["Street", location.street],
    ["Street 2", location.street2],
    ["城市", location.city],
    ["州", location.state],
    ["邮编", location.postal_code],
    ["国家", location.country],
    ["位置名称", location.location_name],
    ["是否有效", location.isActive ? "是" : "否"]
  ];

  const pricingFields = [
    ["月费", location.monthly_price ? `$${location.monthly_price}/月` : ""],
    ["货币", location.currency],
    ["价格文案", location.price_text],
    ["价格类型", location.price_type],
    ["RDI", location.rdi],
    ["CMRA", location.cmra]
  ];

  const planFields = [
    ["首个计划链接", location.first_plan_url],
    ["首个计划周期", location.first_plan_term],
    ["首个计划 ID", location.first_plan_srvpl_id],
    ["最小编号", location.personalize_min],
    ["最大编号", location.personalize_max],
    ["编号扫描时间", formatDateTime(location.personalize_scanned_at)],
    ["编号扫描错误", location.personalize_error]
  ];

  const sourceFields = [
    ["详情页链接", location.detail_url],
    ["来源页链接", location.source_url],
    ["Smarty 扫描时间", formatDateTime(location.smarty_scanned_at)],
    ["Smarty 错误", location.smarty_error],
    ["首次发现", formatDateTime(location.first_seen_at)],
    ["最后发现", formatDateTime(location.last_seen_at)],
    ["创建时间", formatDateTime(location.created_at)],
    ["更新时间", formatDateTime(location.updated_at)]
  ];

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className={styles.page}>
        <section className={styles.header}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/" className={styles.breadcrumbLink}>
              首页
            </Link>
            <span className={styles.breadcrumbDivider}>/</span>
            {stateName ? (
              <>
                <Link href={stateHref} className={styles.breadcrumbLink}>
                  {stateName}
                </Link>
                <span className={styles.breadcrumbDivider}>/</span>
              </>
            ) : null}
            <span className={styles.breadcrumbCurrent}>{location.full_address}</span>
          </nav>
          <Link href={stateHref} className={styles.back}>
            返回州页
          </Link>
          <h1 className={styles.title}>{location.full_address}</h1>
          <DetailActions detailUrl={location.detail_url} mapUrl={mapUrl} />
        </section>

        <section className={styles.copySection}>
          <div className={styles.copyInner}>
            <p className={styles.copyText}>
              这个页面集中展示当前地址的月费、RDI、CMRA、编号范围和来源信息，适合在进入官网之前先判断它是否更接近你想要的美国住宅地址或美国私人地址用途。
            </p>
            <p className={styles.copyText}>
              如果你正在比较多个 Anytime Mailbox 地址，建议重点对比 RDI、CMRA、首次发现时间以及编号范围，再决定是否继续进入官网详情页。
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>基础信息</h2>
          </div>
          <div className={styles.metaGrid}>{renderFieldItems(basicFields, styles)}</div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>价格与验证</h2>
          </div>
          <div className={styles.metaGrid}>{renderFieldItems(pricingFields, styles)}</div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>计划与编号扫描</h2>
          </div>
          <div className={styles.metaGrid}>{renderFieldItems(planFields, styles)}</div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>时间与来源</h2>
          </div>
          <div className={styles.metaGrid}>{renderFieldItems(sourceFields, styles)}</div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>服务与原始数据</h2>
          </div>
          <div className={styles.dataStack}>
            <div className={styles.dataBlock}>
              <div className={styles.metaLabel}>Services</div>
              <pre className={styles.codeBlock}>
                {location.services?.length ? JSON.stringify(location.services, null, 2) : ""}
              </pre>
            </div>
            <div className={styles.dataBlock}>
              <div className={styles.metaLabel}>Raw</div>
              <pre className={styles.codeBlock}>
                {location.raw ? JSON.stringify(location.raw, null, 2) : ""}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}

function renderFieldItems(fields, styles) {
  return fields.map(([label, value]) => (
    <div key={label} className={styles.metaItem}>
      <div className={styles.metaLabel}>{label}</div>
      <div className={styles.metaValue}>{stringifyValue(value)}</div>
    </div>
  ));
}

function stringifyValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function buildMapUrl(address) {
  const encoded = encodeURIComponent(address || "");
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}
