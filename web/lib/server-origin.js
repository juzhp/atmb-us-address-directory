import { headers } from "next/headers";

export async function getServerApiOrigin() {
  if (process.env.INTERNAL_API_ORIGIN) {
    return process.env.INTERNAL_API_ORIGIN;
  }

  const headerStore = await headers();
  const host = headerStore.get("host");
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const proto = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host) {
    return `${proto}://${host}`;
  }

  return "http://127.0.0.1:3000";
}
