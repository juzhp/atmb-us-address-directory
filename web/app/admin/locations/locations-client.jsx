"use client";

import { useEffect, useState } from "react";
import { getStateName } from "../../../lib/states.js";
import styles from "../management.module.css";

const initialFilters = {
  q: "",
  state: "",
  rdi: "",
  cmra: ""
};

export function LocationsClient() {
  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [states, setStates] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(initialFilters);
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      loadStatus(),
      loadStats(),
      loadStates(),
      loadLocations(1, initialFilters)
    ]);
  }, []);

  useEffect(() => {
    if (!status?.isRunning) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void Promise.all([loadStatus(), loadStats(), loadLocations(page, filters)]);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [filters, page, status?.isRunning]);

  async function loadStatus() {
    const response = await fetch("/api/admin/crawl/status", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    setStatus(await response.json());
  }

  async function loadStats() {
    const response = await fetch("/api/public/stats", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    setStats(await response.json());
  }

  async function loadStates() {
    const response = await fetch("/api/public/states", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    setStates(payload || []);
  }

  async function loadLocations(nextPage, nextFilters) {
    const params = new URLSearchParams({
      page: String(nextPage),
      limit: String(limit)
    });

    if (nextFilters.q) {
      params.set("q", nextFilters.q);
    }
    if (nextFilters.state) {
      params.set("state", nextFilters.state);
    }
    if (nextFilters.rdi) {
      params.set("rdi", nextFilters.rdi);
    }
    if (nextFilters.cmra) {
      params.set("cmra", nextFilters.cmra);
    }

    const response = await fetch(`/api/admin/locations?${params.toString()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      setError("地址数据加载失败。");
      return;
    }

    const payload = await response.json();
    setRows(payload.items || []);
    setTotal(payload.total || 0);
    setPage(payload.page || nextPage);
  }

  async function startJob(url, payload) {
    setError("");

    const response = await fetch(url, {
      method: "POST",
      headers: payload
        ? {
            "content-type": "application/json"
          }
        : undefined,
      body: payload ? JSON.stringify(payload) : undefined
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setError(body?.reason || body?.message || "任务启动失败。");
      return;
    }

    await Promise.all([loadStatus(), loadStats(), loadLocations(page, filters)]);
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const running = Boolean(status?.isRunning);
  const personalizeCount = rows.filter(
    (item) => typeof item.personalize_min === "number" && typeof item.personalize_max === "number"
  ).length;
  const smartyCount = rows.filter((item) => item.rdi || item.cmra).length;

  return (
    <>
      <section className={styles.section}>
        <div className={styles.hero}>
          <div>
            <h1 className={styles.heroTitle}>地址管理</h1>
            <p className={styles.heroText}>
              抓取地址、扫描编号范围、补全 RDI/CMRA，并查看当前筛选结果下的地址列表。
            </p>
            <div className={styles.hint}>任务会按当前筛选条件执行。</div>
          </div>

          <div className={styles.heroActions}>
            <button
              type="button"
              className={styles.button}
              disabled={running}
              onClick={() => startJob("/api/admin/crawl/start")}
            >
              开始抓取
            </button>
            <button
              type="button"
              className={styles.buttonGhost}
              disabled={running}
              onClick={() =>
                startJob("/api/admin/crawl/personalize/start", {
                  query: filters.q,
                  state: filters.state,
                  rdi: filters.rdi,
                  cmra: filters.cmra
                })
              }
            >
              扫描编号范围
            </button>
            <button
              type="button"
              className={styles.buttonGhost}
              disabled={running}
              onClick={() =>
                startJob("/api/admin/crawl/smarty/start", {
                  query: filters.q,
                  state: filters.state,
                  rdi: filters.rdi,
                  cmra: filters.cmra
                })
              }
            >
              补全 RDI/CMRA
            </button>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statLabel}>地址总数</div>
            <div className={styles.statValue}>{total}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>已补全编号范围</div>
            <div className={styles.statValue}>{personalizeCount}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>已补全 RDI/CMRA</div>
            <div className={styles.statValue}>{smartyCount || stats?.enrichedCount || 0}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>全部有效地址</div>
            <div className={styles.statValue}>{stats?.activeLocations ?? 0}</div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subheading}>任务状态</h2>
        <dl className={styles.statusGrid}>
          <div className={styles.statusItem}>
            <dt>状态</dt>
            <dd>{status?.job?.status || "idle"}</dd>
          </div>
          <div className={styles.statusItem}>
            <dt>任务类型</dt>
            <dd>{formatJobType(status?.job?.type)}</dd>
          </div>
          <div className={styles.statusItem}>
            <dt>开始时间</dt>
            <dd>{formatDate(status?.job?.started_at)}</dd>
          </div>
          <div className={styles.statusItem}>
            <dt>结束时间</dt>
            <dd>{formatDate(status?.job?.finished_at)}</dd>
          </div>
        </dl>
        {status?.job?.error ? <div className={styles.error}>{status.job.error}</div> : null}
      </section>

      <section className={styles.section}>
        <h2 className={styles.subheading}>筛选</h2>
        <form
          className={styles.filtersCompact}
          onSubmit={(event) => {
            event.preventDefault();
            const nextFilters = {
              q: draftFilters.q.trim(),
              state: draftFilters.state,
              rdi: draftFilters.rdi,
              cmra: draftFilters.cmra
            };
            setFilters(nextFilters);
            setPage(1);
            void loadLocations(1, nextFilters);
          }}
        >
          <div className={styles.fieldGroup}>
            <label className={styles.label}>搜索</label>
            <input
              className={styles.field}
              value={draftFilters.q}
              onChange={(event) => setDraftFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="名称、城市、地址"
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>州</label>
            <select
              className={styles.select}
              value={draftFilters.state}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, state: event.target.value }))
              }
            >
              <option value="">全部州</option>
              {states.map((item) => (
                <option key={item.state} value={item.state}>
                  {getStateName(item.state)} ({item.state})
                </option>
              ))}
            </select>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>RDI</label>
            <select
              className={styles.select}
              value={draftFilters.rdi}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, rdi: event.target.value }))
              }
            >
              <option value="">全部</option>
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
            </select>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>CMRA</label>
            <select
              className={styles.select}
              value={draftFilters.cmra}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, cmra: event.target.value }))
              }
            >
              <option value="">全部</option>
              <option value="Y">Y</option>
              <option value="N">N</option>
            </select>
          </div>
          <button type="submit" className={styles.button}>
            查询
          </button>
          <button
            type="button"
            className={styles.buttonGhost}
            onClick={() => {
              setDraftFilters(initialFilters);
              setFilters(initialFilters);
              setPage(1);
              void loadLocations(1, initialFilters);
            }}
          >
            重置
          </button>
        </form>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subheading}>地址列表</h2>
        <p className={styles.tableMeta}>
          共 {total} 条记录，当前第 {page} / {totalPages} 页。
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>名称</th>
                <th>地址</th>
                <th>州</th>
                <th>月费</th>
                <th>最小号</th>
                <th>最大号</th>
                <th>RDI</th>
                <th>CMRA</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className={styles.cellTitle}>{item.location_name || "-"}</div>
                      <div className={styles.cellMeta}>ID: {item.id}</div>
                    </td>
                    <td>
                      <div>{item.full_address || "-"}</div>
                      <div className={styles.cellMeta}>{item.city || "-"}</div>
                    </td>
                    <td>{item.state || "-"}</td>
                    <td>{formatCurrency(item.monthly_price)}</td>
                    <td>{formatRange(item.personalize_min)}</td>
                    <td>{formatRange(item.personalize_max)}</td>
                    <td>{item.rdi || ""}</td>
                    <td>{item.cmra || ""}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>当前没有匹配的地址。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.buttonGhost}
            disabled={page <= 1}
            onClick={() => {
              const nextPage = page - 1;
              setPage(nextPage);
              void loadLocations(nextPage, filters);
            }}
          >
            上一页
          </button>
          <button
            type="button"
            className={styles.buttonGhost}
            disabled={page >= totalPages}
            onClick={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              void loadLocations(nextPage, filters);
            }}
          >
            下一页
          </button>
        </div>
        {error ? <div className={styles.error}>{error}</div> : null}
      </section>
    </>
  );
}

function formatCurrency(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function formatRange(value) {
  return typeof value === "number" && !Number.isNaN(value) ? String(value) : "-";
}

function formatJobType(value) {
  if (value === "locations") {
    return "地址抓取";
  }
  if (value === "personalize") {
    return "编号扫描";
  }
  if (value === "smarty") {
    return "Smarty 补全";
  }
  return "-";
}
