"use client";

import { useEffect, useState } from "react";
import styles from "../management.module.css";

export function SettingsClient() {
  const [headCode, setHeadCode] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/settings", { cache: "no-store" });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setError(body?.message || "设置加载失败。");
      setLoading(false);
      return;
    }

    setHeadCode(body?.headCode || "");
    setSavedAt(body?.updatedAt || "");
    setLoading(false);
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        headCode
      })
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.message || "设置保存失败。");
      setSaving(false);
      return;
    }

    setHeadCode(body?.headCode || "");
    setSavedAt(body?.updatedAt || "");
    setSuccess("已保存。新的 Head 代码会用于前端页面。");
    setSaving(false);
  }

  return (
    <>
      <section className={styles.section}>
        <div className={styles.hero}>
          <div>
            <h1 className={styles.heroTitle}>站点设置</h1>
            <p className={styles.heroText}>
              管理站点级配置。当前先提供 Head 代码管理，适合放置 Google Analytics、GTM 或其他统计脚本。
            </p>
            <div className={styles.hint}>
              保存后会注入到前端页面的 head 中。{savedAt ? `最近更新：${formatDateTime(savedAt)}` : ""}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subheading}>Head 代码</h2>
        <form onSubmit={saveSettings}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>可粘贴 script、meta、link、noscript、style 等代码</label>
            <textarea
              className={styles.textarea}
              value={headCode}
              onChange={(event) => setHeadCode(event.target.value)}
              placeholder={`<!-- Google tag (gtag.js) -->\n<script async src=\"https://www.googletagmanager.com/gtag/js?id=G-XXXX\"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', 'G-XXXX');\n</script>`}
            />
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.button} disabled={loading || saving}>
              {saving ? "保存中..." : "保存设置"}
            </button>
          </div>
        </form>
        {loading ? <div className={styles.hint}>正在加载设置...</div> : null}
        {error ? <div className={styles.error}>{error}</div> : null}
        {success ? <div className={styles.passwordSuccess}>{success}</div> : null}
      </section>
    </>
  );
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
