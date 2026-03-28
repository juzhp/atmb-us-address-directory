"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./page.module.css";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      username: String(formData.get("username") || ""),
      password: String(formData.get("password") || "")
    };

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message || "登录失败。");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h1 className={styles.title}>后台登录</h1>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="username">
          用户名
        </label>
        <input
          id="username"
          name="username"
          defaultValue="admin"
          className={styles.field}
          autoComplete="username"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="password">
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          defaultValue="admin"
          className={styles.field}
          autoComplete="current-password"
        />
      </div>

      <button type="submit" className={styles.button} disabled={loading}>
        {loading ? "登录中..." : "登录"}
      </button>

      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.hint}>默认账号：admin / admin</div>
    </form>
  );
}
