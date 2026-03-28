"use client";

import { useEffect, useState } from "react";
import styles from "../management.module.css";

const initialForm = {
  name: "",
  authId: "",
  authToken: "",
  quotaLimit: "",
  priority: "100"
};

export function TokensClient() {
  const [tokens, setTokens] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadTokens();
  }, []);

  async function loadTokens() {
    const response = await fetch("/api/admin/smarty/tokens", { cache: "no-store" });
    if (!response.ok) {
      setError("Smarty token 加载失败。");
      return;
    }

    setTokens(await response.json());
  }

  async function createToken(event) {
    event.preventDefault();
    setError("");

    const payload = {
      name: form.name.trim(),
      authId: form.authId.trim(),
      authToken: form.authToken.trim(),
      quotaLimit: Number(form.quotaLimit || 0),
      priority: Number(form.priority || 100),
      status: "active"
    };

    const response = await fetch("/api/admin/smarty/tokens", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.message || "创建 Smarty token 失败。");
      return;
    }

    setForm(initialForm);
    await loadTokens();
  }

  async function patchToken(id, patch) {
    const response = await fetch(`/api/admin/smarty/tokens/${id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(patch)
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.message || "更新 Smarty token 失败。");
      return;
    }

    await loadTokens();
  }

  async function resetUsage(id) {
    const response = await fetch(`/api/admin/smarty/tokens/${id}/reset-usage`, {
      method: "POST"
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.message || "重置用量失败。");
      return;
    }

    await loadTokens();
  }

  const remaining = tokens
    .filter((token) => token.status === "active")
    .reduce((sum, token) => sum + (token.quotaRemaining || 0), 0);

  return (
    <>
      <section className={styles.section}>
        <div className={styles.hero}>
          <div>
            <h1 className={styles.heroTitle}>Smarty 密钥管理</h1>
            <p className={styles.heroText}>
              管理多个 Smarty 凭证、优先级和本地额度，用于 RDI/CMRA 的批量补全任务。
            </p>
            <div className={styles.hint}>当前 active token 剩余额度：{remaining}</div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subheading}>新增密钥</h2>
        <form className={styles.tokenForm} onSubmit={createToken}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>名称</label>
            <input
              className={styles.field}
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Auth ID</label>
            <input
              className={styles.field}
              value={form.authId}
              onChange={(event) =>
                setForm((current) => ({ ...current, authId: event.target.value }))
              }
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Auth Token</label>
            <input
              className={styles.field}
              type="password"
              value={form.authToken}
              onChange={(event) =>
                setForm((current) => ({ ...current, authToken: event.target.value }))
              }
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>额度</label>
            <input
              className={styles.field}
              type="number"
              min="0"
              value={form.quotaLimit}
              onChange={(event) =>
                setForm((current) => ({ ...current, quotaLimit: event.target.value }))
              }
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>优先级</label>
            <input
              className={styles.field}
              type="number"
              min="0"
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({ ...current, priority: event.target.value }))
              }
            />
          </div>
          <button type="submit" className={styles.button}>
            添加密钥
          </button>
        </form>
        {error ? <div className={styles.error}>{error}</div> : null}
      </section>

      <section className={styles.section}>
        <h2 className={styles.subheading}>密钥列表</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>名称</th>
                <th>Auth ID</th>
                <th>额度</th>
                <th>已用</th>
                <th>剩余</th>
                <th>状态</th>
                <th>优先级</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tokens.length > 0 ? (
                tokens.map((token) => (
                  <tr key={token.id}>
                    <td>{token.name}</td>
                    <td>{token.authId}</td>
                    <td>
                      <input
                        className={styles.inlineInput}
                        type="number"
                        min="0"
                        defaultValue={token.quotaLimit}
                        onBlur={(event) =>
                          patchToken(token.id, { quotaLimit: Number(event.target.value || 0) })
                        }
                      />
                    </td>
                    <td>{token.quotaUsed}</td>
                    <td>{token.quotaRemaining}</td>
                    <td>
                      <select
                        className={styles.inlineSelect}
                        defaultValue={token.status}
                        onChange={(event) =>
                          patchToken(token.id, { status: event.target.value })
                        }
                      >
                        <option value="active">active</option>
                        <option value="disabled">disabled</option>
                        <option value="exhausted">exhausted</option>
                        <option value="error">error</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className={styles.inlineInput}
                        type="number"
                        min="0"
                        defaultValue={token.priority}
                        onBlur={(event) =>
                          patchToken(token.id, { priority: Number(event.target.value || 0) })
                        }
                      />
                    </td>
                    <td>
                      <div className={styles.tokenActions}>
                        <button
                          type="button"
                          className={styles.buttonGhost}
                          onClick={() => resetUsage(token.id)}
                        >
                          重置用量
                        </button>
                        {token.lastError ? <div className={styles.cellMeta}>{token.lastError}</div> : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>还没有配置 Smarty 密钥。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
