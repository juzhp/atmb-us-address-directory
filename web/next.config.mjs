import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRootEnv } from "../env/load-root-env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

loadRootEnv(projectRoot);

const apiOrigin = process.env.API_ORIGIN || "http://127.0.0.1:3000";

export default {
  reactStrictMode: true,
  outputFileTracingRoot: projectRoot,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`
      }
    ];
  }
};
