#!/usr/bin/env node

import { generateTokens, exchangeCodeForTokens } from "./oauth.js";

async function main() {
  const command = process.argv[2];
  const code = process.argv[3];

  switch (command) {
    case "setup":
      await generateTokens();
      break;

    case "auth":
      if (!code) {
        console.error("❌ Please provide the authorization code");
        console.error("Usage: npm run auth <authorization_code>");
        process.exit(1);
      }
      await exchangeCodeForTokens(code);
      break;

    default:
      console.log("🔐 Google OAuth2 CLI Helper");
      console.log("=============================");
      console.log();
      console.log("Commands:");
      console.log("  npm run setup     - Generate authorization URL");
      console.log("  npm run auth <code> - Exchange code for tokens");
      console.log();
      console.log("Example workflow:");
      console.log("1. npm run setup");
      console.log("2. Visit the URL and authorize");
      console.log("3. Copy the code from redirect URL");
      console.log("4. npm run auth <your_code>");
      console.log();
      break;
  }
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
