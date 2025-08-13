import "dotenv/config";
import cron from "node-cron";
import { runSync } from "./sync.js";

// const expr = process.env.CRON_EXPR || "0 * * * *"; // mỗi giờ
// console.log(`[cron] scheduling: ${expr}`);

// cron.schedule(expr, async () => {
//   console.log(`[cron] start at ${new Date().toISOString()}`);
//   try {
//     await runSync();
//     console.log("[cron] done");
//   } catch (err) {
//     console.error("[cron] error:", err);
//   }
// });

// // Cho phép chạy foreground khi dev
if (process.env.NODE_ENV !== "production") {
  console.log("[cron] dev mode: running once immediately...");
  runSync().catch(console.error);
}
