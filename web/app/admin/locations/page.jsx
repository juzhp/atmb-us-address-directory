import { requireAdminSession } from "../../../lib/admin-auth.js";
import { LocationsClient } from "./locations-client.jsx";

export default async function AdminLocationsPage() {
  await requireAdminSession();
  return <LocationsClient />;
}
