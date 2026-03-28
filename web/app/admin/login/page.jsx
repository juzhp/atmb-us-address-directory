import { redirectIfAuthenticated } from "../../../lib/admin-auth.js";
import { LoginForm } from "./login-form.jsx";
import styles from "./page.module.css";

export default async function AdminLoginPage() {
  await redirectIfAuthenticated();

  return (
    <div className={styles.page}>
      <LoginForm />
    </div>
  );
}
