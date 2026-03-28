export function getSiteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3001";

  return configured.replace(/\/+$/, "");
}
