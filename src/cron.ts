import "dotenv/config";
import cron from "node-cron";
import { runSync } from "./sync.js";

const expr = "0 9,17 * * *"; // cron mỗi 9h sáng và 17h chiều
console.log(`[cron] scheduling: ${expr}`);

cron.schedule(expr, async () => {
  console.log(`[cron] start at ${new Date().toISOString()}`);
  try {
    await runSync();
    console.log("[cron] done");
  } catch (err) {
    console.error("[cron] error:", err);
  }
});

// Cho phép chạy foreground khi dev
if (process.env.NODE_ENV !== "production") {
  console.log("[cron] dev mode: running once immediately...");
  runSync().catch(console.error);
}
