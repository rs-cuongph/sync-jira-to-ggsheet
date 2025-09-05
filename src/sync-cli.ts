#!/usr/bin/env node

import { config } from "dotenv";
import {
  syncJira2Sheet,
  syncOrEstimateAndTimeSpent,
} from "./tasks/sync-jira2sheet/sync.js";

config();

async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case "sync":
        console.log("🔄 Running full sync (WBS_DEV + WBS_QC)...");
        await syncJira2Sheet();
        console.log("✅ Full sync completed!");
        break;

      case "estimate":
        console.log(
          "📊 Running estimate and time spent sync (WBS_DEV only)..."
        );
        await syncOrEstimateAndTimeSpent();
        console.log("✅ Estimate and time spent sync completed!");
        break;

      default:
        console.log("🔄 Jira to Google Sheets Sync CLI");
        console.log("=================================");
        console.log();
        console.log("Commands:");
        console.log("  sync     - Full sync (WBS_DEV + WBS_QC sheets)");
        console.log("  estimate - Estimate and time spent sync (WBS_DEV only)");
        console.log();
        console.log("Environment variables required:");
        console.log("  JIRA_USERNAME");
        console.log("  JIRA_PASSWORD");
        console.log("  JIRA_URL");
        console.log("  GOOGLE_SHEET_ID");
        console.log();
        console.log("Examples:");
        console.log("  npm run sync-cli sync");
        console.log("  npm run sync-cli estimate");
        console.log();
        console.log(
          "Note: Make sure you have valid Jira cookies and Google OAuth tokens"
        );
        console.log("Run 'npm run cookie get' and 'npm run auth' if needed");
        break;
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
