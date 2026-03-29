"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import styles from "../states/[stateSlug]/page.module.css";

export function ResidentialPageClient({ items, total, selectedQuery, selectedCmra }) {
  const pathname = usePathname();
  const [visitedIds, setVisitedIds] = useState(() => new Set());
  const hasFilters = Boolean(selectedQuery || selectedCmra);
  const cmraOptions = buildOptions(items.map((item) => item.cmra));
  const resultCount = items.length;

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <Link href="/" className={styles.breadcrumbLink}>
            首页
          </Link>
          <span className={styles.breadcrumbDivider}>/</span>
          <span className={styles.breadcrumbCurrent}>查询住宅地址</span>
        </nav>
        <p className={styles.eyebrow}>Residential Address Directory</p>
        <h1 className={styles.title}>查询美国住宅地址</h1>
        <p className={styles.lede}>
          这个页面集中展示 `RDI = Residential` 的 Anytime Mailbox 地址，方便你按关键词和 CMRA 进一步缩小范围。
        </p>
        <div className={styles.count}>
          {hasFilters
            ? `显示 ${resultCount} / ${total} 条住宅地址`
            : `共 ${total} 条住宅地址`}
        </div>
      </section>

      <section className={styles.listSection}>
        <form action={pathname} method="get" className={styles.filters}>
          <div className={styles.filterIntro}>
            <div className={styles.filterTitle}>筛选住宅地址</div>
            <div className={styles.filterHint}>支持关键词查询，并按 CMRA 继续筛选。</div>
          </div>

          <div className={styles.filterControls}>
            <div className={styles.filterField}>
              <label htmlFor="residential-query" className={styles.filterLabel}>
                关键词
              </label>
              <input
                id="residential-query"
                name="q"
                className={styles.select}
                defaultValue={selectedQuery}
                placeholder="名称、城市、地址"
              />
            </div>

            <div className={styles.filterField}>
              <label htmlFor="residential-cmra" className={styles.filterLabel}>
                CMRA
              </label>
              <select
                id="residential-cmra"
                name="cmra"
                className={styles.select}
                defaultValue={selectedCmra}
              >
                <option value="">全部</option>
                {cmraOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.filterActions}>
            <button type="submit" className={styles.submitButton}>
              查询
            </button>
            {hasFilters ? (
              <Link href={pathname} className={styles.resetButton}>
                重置
              </Link>
            ) : null}
          </div>
        </form>

        <div className={styles.table}>
          <div className={styles.head}>
            <div>地址</div>
            <div>州</div>
            <div>月费</div>
            <div>CMRA</div>
            <div>首次发现</div>
            <div>最小编号</div>
            <div>操作</div>
          </div>

          <div className={styles.tableBody}>
            {items.map((location) => {
              const visited = visitedIds.has(location.id);

              return (
                <div
                  key={location.id}
                  className={`${styles.row} ${visited ? styles.rowVisited : ""}`}
                >
                  <Link
                    href={buildLocationHref(location)}
                    className={styles.rowOverlay}
                    aria-label={`查看 ${location.full_address}`}
                    onClick={() => markVisited(location.id, setVisitedIds)}
                  />
                  <div className={styles.rowMain} aria-hidden="true">
                    <div className={styles.addressCell}>
                      <div className={styles.locationName}>{location.location_name}</div>
                      <div className={styles.addressText}>{location.full_address}</div>
                    </div>
                    <div className={styles.cell}>{location.state || ""}</div>
                    <div className={styles.cell}>
                      {location.monthly_price ? `$${location.monthly_price}/月` : ""}
                    </div>
                    <div className={styles.cell}>{renderHighlightedValue(location.cmra, styles)}</div>
                    <div className={styles.cell}>{formatDate(location.first_seen_at)}</div>
                    <div className={styles.cell}>
                      {location.personalize_min ? location.personalize_min : ""}
                    </div>
                  </div>
                  <div className={`${styles.cell} ${styles.actionCell}`}>
                    <div className={styles.actions}>
                      <a
                        href={buildMapUrl(location.full_address)}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.action}
                        onClick={() => markVisited(location.id, setVisitedIds)}
                      >
                        查看地图
                      </a>
                      {location.detail_url ? (
                        <a
                          href={location.detail_url}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.action}
                          onClick={() => markVisited(location.id, setVisitedIds)}
                        >
                          跳转官网
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.mobileList}>
          {items.map((location) => {
            const visited = visitedIds.has(location.id);

            return (
              <div
                key={location.id}
                className={`${styles.mobileCard} ${visited ? styles.mobileCardVisited : ""}`}
              >
                <Link
                  href={buildLocationHref(location)}
                  className={styles.mobileCardMain}
                  aria-label={`查看 ${location.full_address}`}
                  onClick={() => markVisited(location.id, setVisitedIds)}
                >
                  <div className={styles.locationName}>{location.location_name}</div>
                  <div className={styles.mobileAddress}>{location.full_address}</div>
                  <div className={styles.mobileMeta}>
                    <div>
                      <strong>州</strong>
                      <span>{location.state || ""}</span>
                    </div>
                    <div>
                      <strong>月费</strong>
                      <span>{location.monthly_price ? `$${location.monthly_price}/月` : ""}</span>
                    </div>
                    <div>
                      <strong>CMRA</strong>
                      <span className={styles.mobileMetaValue}>
                        {renderHighlightedValue(location.cmra, styles)}
                      </span>
                    </div>
                    <div>
                      <strong>首次发现</strong>
                      <span>{formatDate(location.first_seen_at)}</span>
                    </div>
                    <div>
                      <strong>最小编号</strong>
                      <span>{location.personalize_min ? location.personalize_min : ""}</span>
                    </div>
                  </div>
                </Link>
                <div className={styles.mobileActions}>
                  <a
                    href={buildMapUrl(location.full_address)}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.mobileAction}
                    onClick={() => markVisited(location.id, setVisitedIds)}
                  >
                    查看地图
                  </a>
                  {location.detail_url ? (
                    <a
                      href={location.detail_url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.mobileAction}
                      onClick={() => markVisited(location.id, setVisitedIds)}
                    >
                      跳转官网
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {items.length === 0 ? (
          <div className={styles.empty}>
            {hasFilters
              ? "当前筛选条件下没有匹配的住宅地址。"
              : "当前还没有可展示的住宅地址数据。"}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function buildOptions(values) {
  return Array.from(
    new Set(values.filter((value) => typeof value === "string" && value.trim()))
  ).sort((left, right) => left.localeCompare(right));
}

function buildLocationHref(location) {
  return `/locations/${slugify(location.location_name || location.locationName)}-${location.id}`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function buildMapUrl(address) {
  const encoded = encodeURIComponent(address || "");
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}

function markVisited(id, setVisitedIds) {
  setVisitedIds((current) => {
    const next = new Set(current);
    next.add(id);
    return next;
  });
}

function renderHighlightedValue(value, styles) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "";
  }

  if (normalized === "N") {
    return <span className={styles.valueGood}>{normalized}</span>;
  }

  return normalized;
}
