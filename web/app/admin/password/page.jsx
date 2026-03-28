import { requireAdminSession } from "../../../lib/admin-auth.js";
import { PasswordForm } from "./password-form.jsx";
import styles from "../management.module.css";

export const dynamic = "force-dynamic";

export default async function AdminPasswordPage() {
  await requireAdminSession();

  return (
    <div className={styles.passwordPage}>
      <PasswordForm />
    </div>
  );
}
