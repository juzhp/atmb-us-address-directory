import { cookies } from "next/headers";
import { getServerApiOrigin } from "./server-origin.js";

export async function fetchAdminLocations(searchParams = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const serverApiOrigin = await getServerApiOrigin();

  const response = await fetch(`${serverApiOrigin}/api/admin/locations?${params.toString()}`, {
    headers: cookieHeader
      ? {
          cookie: cookieHeader
        }
      : {},
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to load admin locations.");
  }

  return response.json();
}
