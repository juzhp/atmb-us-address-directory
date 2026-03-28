import path from "node:path";

const rootDir = process.cwd();

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "0.0.0.0",
  baseUrl: "https://www.anytimemailbox.com",
  usaUrl: "https://www.anytimemailbox.com/l/usa",
  userAgent:
    process.env.ATMB_USER_AGENT ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 20000),
  requestRetries: Number(process.env.REQUEST_RETRIES || 2),
  concurrency: Number(process.env.CRAWL_CONCURRENCY || 4),
  dbPath: process.env.DB_PATH || path.join(rootDir, "data", "atmb.sqlite"),
  smartyAuthId: process.env.SMARTY_AUTH_ID || "",
  smartyAuthToken: process.env.SMARTY_AUTH_TOKEN || "",
  smartyApiBaseUrl:
    process.env.SMARTY_API_BASE_URL || "https://us-street.api.smarty.com/street-address"
};
