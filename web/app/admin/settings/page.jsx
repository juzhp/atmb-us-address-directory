import { requireAdminSession } from "../../../lib/admin-auth.js";
import { SettingsClient } from "./settings-client.jsx";

export default async function AdminSettingsPage() {
  await requireAdminSession();
  return <SettingsClient />;
}
