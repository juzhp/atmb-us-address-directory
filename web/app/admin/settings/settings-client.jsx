"use client";

import { useEffect, useState } from "react";
import styles from "../management.module.css";

export function SettingsClient() {
  const [headCode, setHeadCode] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  const [apiKeySuccess, setApiKeySuccess] = useState("");

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");
    setApiKeyError("");

    const [settingsResponse, keysResponse] = await Promise.all([
      fetch("/api/admin/settings", { cache: "no-store" }),
      fetch("/api/admin/api-keys", { cache: "no-store" })
    ]);

    const settingsBody = await settingsResponse.json().catch(() => null);
    const keysBody = await keysResponse.json().catch(() => null);

    if (!settingsResponse.ok) {
      setError(settingsBody?.message || "设置加载失败。");
    } else {
      setHeadCode(settingsBody?.headCode || "");
      setSavedAt(settingsBody?.updatedAt || "");
    }

    if (!keysResponse.ok) {
      setApiKeyError(keysBody?.message || "密钥列表加载失败。");
    } else {
      setApiKeys(Array.isArray(keysBody) ? keysBody : []);
    }

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
      body: JSON.stringify({ headCode })
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.message || "设置保存失败。");
      setSaving(false);
      return;
    }

    setHeadCode(body?.headCode || "");
    setSavedAt(body?.updatedAt || "");
    setSuccess("已保存。新的 Head 代码会应用到前端所有页面。");
    setSaving(false);
  }

  async function createNewApiKey(event) {
    event.preventDefault();
    if (!newKeyName.trim()) {
      setApiKeyError("请输入密钥名称。");
      return;
    }

    setCreatingKey(true);
    setApiKeyError("");
    setApiKeySuccess("");
    setCreatedKey("");

    const response = await fetch("/api/admin/api-keys", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ name: newKeyName.trim() })
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setApiKeyError(body?.message || "密钥创建失败。");
      setCreatingKey(false);
      return;
    }

    setApiKeys((current) => [stripPlaintextKey(body), ...current]);
    setCreatedKey(body?.key || "");
    setNewKeyName("");
    setApiKeySuccess("密钥已创建。请立即复制保存，明文只会显示这一次。");
    setCreatingKey(false);
  }

  async function removeApiKey(id) {
    if (!window.confirm("删除后该密钥将立即失效，确定继续吗？")) {
      return;
    }

    setDeletingKeyId(id);
    setApiKeyError("");
    setApiKeySuccess("");

    const response = await fetch(`/api/admin/api-keys/${id}`, {
      method: "DELETE"
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setApiKeyError(body?.message || "密钥删除失败。");
      setDeletingKeyId(0);
      return;
    }

    setApiKeys((current) => current.filter((item) => item.id !== id));
    setDeletingKeyId(0);
    setApiKeySuccess("密钥已删除。");
  }

  return (
    <>
      <section className={styles.section}>
        <div className={styles.hero}>
          <div>
            <h1 className={styles.heroTitle}>站点设置</h1>
            <p className={styles.heroText}>
              管理前端 Head 代码和对外修数密钥。你后续可以用这些密钥写单独脚本，查询
              Residential 数据或按 id 更新某条记录。
            </p>
            <div className={styles.hint}>
              保存 Head 代码后会注入到前端页面的 head 中。
              {savedAt ? ` 最近更新：${formatDateTime(savedAt)}` : ""}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subheading}>Head 代码管理</h2>
        <form onSubmit={saveSettings}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              可粘贴 script、meta、link、noscript、style 等代码
            </label>
            <textarea
              className={styles.textarea}
              value={headCode}
              onChange={(event) => setHeadCode(event.target.value)}
              placeholder={`<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', 'G-XXXX');\n</script>`}
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

      <section className={styles.section}>
        <h2 className={styles.subheading}>开放接口密钥</h2>
        <div className={styles.stack}>
          <form className={styles.apiKeyForm} onSubmit={createNewApiKey}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>密钥名称</label>
              <input
                className={styles.field}
                value={newKeyName}
                onChange={(event) => setNewKeyName(event.target.value)}
                placeholder="例如：数据修正脚本"
              />
            </div>
            <button type="submit" className={styles.button} disabled={creatingKey}>
              {creatingKey ? "创建中..." : "新增密钥"}
            </button>
          </form>

          <div className={styles.hint}>
            可在请求头中使用 <span className={styles.codeInline}>x-api-key</span>，也支持
            Bearer Token。
          </div>

          {createdKey ? (
            <div className={styles.passwordSuccess}>
              新密钥：<span className={styles.codeInline}>{createdKey}</span>
            </div>
          ) : null}

          <div className={styles.hint}>
            可用接口：
            <br />
            <span className={styles.codeInline}>GET /api/open/locations/residential</span>
            <br />
            <span className={styles.codeInline}>PATCH /api/open/locations/:id</span>
          </div>

          <div className={styles.apiKeyList}>
            {apiKeys.length > 0 ? (
              apiKeys.map((item) => (
                <div key={item.id} className={styles.apiKeyItem}>
                  <div>
                    <div className={styles.apiKeyName}>{item.name}</div>
                    <div className={styles.apiKeyMeta}>
                      前缀：<span className={styles.codeInline}>{item.keyPrefix}</span>
                      <br />
                      最后使用：{item.lastUsedAt ? formatDateTime(item.lastUsedAt) : "未使用"}
                      <br />
                      创建时间：{formatDateTime(item.createdAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.buttonGhost}
                    disabled={deletingKeyId === item.id}
                    onClick={() => void removeApiKey(item.id)}
                  >
                    {deletingKeyId === item.id ? "删除中..." : "删除"}
                  </button>
                </div>
              ))
            ) : (
              <div className={styles.hint}>暂时还没有开放接口密钥。</div>
            )}
          </div>
        </div>

        {apiKeyError ? <div className={styles.error}>{apiKeyError}</div> : null}
        {apiKeySuccess ? <div className={styles.passwordSuccess}>{apiKeySuccess}</div> : null}
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

function stripPlaintextKey(item) {
  if (!item) {
    return null;
  }

  const { key: _key, ...rest } = item;
  return rest;
}
