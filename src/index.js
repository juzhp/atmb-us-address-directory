import { loadRootEnv } from "../env/load-root-env.js";
import { startServer } from "./server.js";

loadRootEnv();

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
