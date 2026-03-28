import { startServer } from "./server.js";

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
