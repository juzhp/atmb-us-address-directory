"use client";

import styles from "../management.module.css";

export function PasswordForm() {
  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const errorElement = form.querySelector("[data-role='error']");
    const successElement = form.querySelector("[data-role='success']");
    const submitButton = form.querySelector("button[type='submit']");

    if (errorElement) {
      errorElement.textContent = "";
    }

    if (successElement) {
      successElement.textContent = "";
    }

    const formData = new FormData(form);
    const currentPassword = String(formData.get("currentPassword") || "");
    const nextPassword = String(formData.get("nextPassword") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (nextPassword !== confirmPassword) {
      if (errorElement) {
        errorElement.textContent = "两次输入的新密码不一致。";
      }
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "提交中...";
    }

    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          currentPassword,
          nextPassword
        })
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (errorElement) {
          errorElement.textContent = body?.message || "修改密码失败。";
        }
        return;
      }

      await fetch("/api/auth/logout", {
        method: "POST"
      }).catch(() => null);

      window.location.href = "/admin/login?changed=1";
    } catch {
      if (errorElement) {
        errorElement.textContent = "修改密码失败。";
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "保存新密码";
      }
    }
  }

  return (
    <form className={styles.passwordStandaloneForm} onSubmit={handleSubmit}>
      <h1 className={styles.passwordStandaloneTitle}>修改密码</h1>

      <div className={styles.passwordFieldGroup}>
        <label className={styles.passwordLabel} htmlFor="current-password">
          当前密码
        </label>
        <input
          id="current-password"
          className={styles.passwordInput}
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      </div>

      <div className={styles.passwordFieldGroup}>
        <label className={styles.passwordLabel} htmlFor="next-password">
          新密码
        </label>
        <input
          id="next-password"
          className={styles.passwordInput}
          type="password"
          name="nextPassword"
          minLength={6}
          autoComplete="new-password"
          required
        />
      </div>

      <div className={styles.passwordFieldGroup}>
        <label className={styles.passwordLabel} htmlFor="confirm-password">
          确认新密码
        </label>
        <input
          id="confirm-password"
          className={styles.passwordInput}
          type="password"
          name="confirmPassword"
          minLength={6}
          autoComplete="new-password"
          required
        />
      </div>

      <button className={styles.passwordSubmit} type="submit">
        保存新密码
      </button>

      <div className={styles.passwordError} data-role="error" />
      <div className={styles.passwordSuccess} data-role="success" />
      <div className={styles.passwordHint}>如果你从未修改过，当前密码通常是 `admin`。</div>
    </form>
  );
}
