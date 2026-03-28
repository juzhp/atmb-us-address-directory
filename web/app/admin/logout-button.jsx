"use client";

import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

export function LogoutButton({ className = "" }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST"
    }).catch(() => null);

    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      className={className || styles.button}
      onClick={handleLogout}
    >
      退出登录
    </button>
  );
}
