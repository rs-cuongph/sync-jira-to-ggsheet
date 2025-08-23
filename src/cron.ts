import "dotenv/config";
import cron from "node-cron";
import { syncJira2Sheet } from "./tasks/sync-jira2sheet/sync.js";

const expr = "0 9,18 * * *"; // cron mỗi 9h sáng và 17h chiều và 19h tối
console.log(`[cron] scheduling: ${expr}`);

cron.schedule(expr, async () => {
  console.log(`[cron] start at ${new Date().toISOString()}`);
  try {
    await syncJira2Sheet();
    console.log("[cron] done");
  } catch (err) {
    console.error("[cron] error:", err);
  }
});

// Cho phép chạy foreground khi dev
if (process.env.NODE_ENV !== "production") {
  console.log("[cron] dev mode: running once immediately...");
  syncJira2Sheet().catch(console.error);
}
