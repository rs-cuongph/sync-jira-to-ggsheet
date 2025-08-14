#!/usr/bin/env node

import { config } from "dotenv";
import { CookieManager } from "./cookie-manager.js";

config();

async function main() {
  const cookieManager = new CookieManager();
  const command = process.argv[2];

  try {
    switch (command) {
      case "get":
        console.log("🔐 Getting Jira session cookie...");
        const cookie = await cookieManager.getCookie();
        console.log("\n📋 Session Cookie String:");
        console.log("=".repeat(60));
        console.log(cookie);
        console.log("=".repeat(60));
        console.log("\n✅ Cookie obtained and cached successfully!");
        break;

      case "clear":
        cookieManager.clearCookie();
        console.log("✅ Cookie cache cleared");
        break;

      case "status":
        const hasValid = cookieManager.hasValidCookie();
        if (hasValid) {
          console.log("✅ Valid cached cookie found");
        } else {
          console.log("❌ No valid cached cookie found");
        }
        break;

      case "refresh":
        console.log("🔄 Refreshing Jira session cookie...");
        cookieManager.clearCookie();
        const freshCookie = await cookieManager.getFreshCookie();
        console.log("\n📋 Fresh Session Cookie String:");
        console.log("=".repeat(60));
        console.log(freshCookie);
        console.log("=".repeat(60));
        console.log("\n✅ Fresh cookie obtained and cached!");
        break;

      default:
        console.log("🍪 Jira Cookie Manager");
        console.log("=====================");
        console.log();
        console.log("Commands:");
        console.log("  get     - Get cookie (cached or fresh)");
        console.log("  clear   - Clear cached cookie");
        console.log("  status  - Check if valid cached cookie exists");
        console.log("  refresh - Force refresh cookie");
        console.log();
        console.log("Environment variables required:");
        console.log("  JIRA_USERNAME");
        console.log("  JIRA_PASSWORD");
        console.log("  JIRA_URL");
        console.log();
        console.log("Example:");
        console.log("  npm run cookie get");
        console.log("  npm run cookie refresh");
        break;
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
