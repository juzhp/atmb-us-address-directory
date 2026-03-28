import { requireAdminSession } from "../../../lib/admin-auth.js";
import { TokensClient } from "./tokens-client.jsx";

export default async function AdminSmartyTokensPage() {
  await requireAdminSession();
  return <TokensClient />;
}
