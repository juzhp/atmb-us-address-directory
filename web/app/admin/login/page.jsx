import { redirectIfAuthenticated } from "../../../lib/admin-auth.js";
import { LoginForm } from "./login-form.jsx";
import styles from "./page.module.css";

export default async function AdminLoginPage({ searchParams }) {
  await redirectIfAuthenticated();
  const resolvedSearchParams = await searchParams;
  const changed = resolvedSearchParams?.changed === "1";

  return (
    <div className={styles.page}>
      <LoginForm changed={changed} />
    </div>
  );
}
