import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerApiOrigin } from "./server-origin.js";

export async function getAdminSession() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const serverApiOrigin = await getServerApiOrigin();

  const response = await fetch(`${serverApiOrigin}/api/auth/me`, {
    headers: cookieHeader
      ? {
          cookie: cookieHeader
        }
      : {},
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return payload.user || null;
}

export async function requireAdminSession() {
  const user = await getAdminSession();

  if (!user || user.role !== "admin") {
    redirect("/admin/login");
  }

  return user;
}

export async function redirectIfAuthenticated() {
  const user = await getAdminSession();

  if (user && user.role === "admin") {
    redirect("/admin");
  }

  return null;
}
