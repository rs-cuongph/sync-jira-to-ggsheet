import "dotenv/config";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

const TOKEN_PATH = path.join(process.cwd(), "token.json");

export class GoogleOAuth2Manager {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback"
    );
  }

  /**
   * Generate authorization URL for user to visit
   */
  generateAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent", // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expiry_date: number;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Failed to get access_token and refresh_token");
    }

    // Save tokens to file
    await this.saveTokens(tokens);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date || 0,
    };
  }

  /**
   * Load tokens from file
   */
  async loadTokens(): Promise<{
    access_token: string;
    refresh_token: string;
    expiry_date: number;
  } | null> {
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
        return tokenData;
      }
    } catch (error) {
      console.warn("Failed to load tokens from file:", error);
    }
    return null;
  }

  /**
   * Save tokens to file
   */
  private async saveTokens(tokens: any): Promise<void> {
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    };

    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
    console.log("Tokens saved to", TOKEN_PATH);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<string> {
    const tokens = await this.loadTokens();
    if (!tokens?.refresh_token) {
      throw new Error("No refresh token available");
    }

    this.oauth2Client.setCredentials({
      refresh_token: tokens.refresh_token,
    });

    const { credentials } = await this.oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error("Failed to refresh access token");
    }

    // Save updated tokens
    await this.saveTokens(credentials);

    return credentials.access_token;
  }

  /**
   * Get authenticated OAuth2 client
   */
  async getAuthenticatedClient(): Promise<OAuth2Client> {
    let tokens = await this.loadTokens();

    if (!tokens) {
      throw new Error("No tokens found. Please authenticate first.");
    }

    // Check if token is expired
    if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
      console.log("Access token expired, refreshing...");
      const newAccessToken = await this.refreshAccessToken();
      tokens = await this.loadTokens();
    }

    if (tokens) {
      this.oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
    }

    return this.oauth2Client;
  }

  /**
   * Check if tokens are valid
   */
  async validateTokens(): Promise<boolean> {
    try {
      const client = await this.getAuthenticatedClient();
      // Test the token by making a simple API call
      const drive = google.drive({ version: "v3", auth: client });
      await drive.files.list({ pageSize: 1 });
      return true;
    } catch (error) {
      console.error("Token validation failed:", error);
      return false;
    }
  }
}

/**
 * CLI helper to generate tokens
 */
export async function generateTokens() {
  const manager = new GoogleOAuth2Manager();

  console.log("🔐 Google OAuth2 Setup");
  console.log("========================");
  console.log();
  console.log("1. Visit this URL to authorize the application:");
  console.log(manager.generateAuthUrl());
  console.log();
  console.log("2. After authorization, you'll be redirected to a URL");
  console.log("3. Copy the 'code' parameter from the URL");
  console.log("4. Run: npm run auth <authorization_code>");
  console.log();
  console.log("Required environment variables:");
  console.log("- GOOGLE_CLIENT_ID");
  console.log("- GOOGLE_CLIENT_SECRET");
  console.log("- GOOGLE_SHEET_ID");
  console.log();
}

/**
 * CLI helper to exchange code for tokens
 */
export async function exchangeCodeForTokens(code: string) {
  try {
    const manager = new GoogleOAuth2Manager();
    const tokens = await manager.getTokensFromCode(code);

    console.log("✅ Authentication successful!");
    console.log("Tokens saved to token.json");
    console.log();
    console.log("You can now run the sync application.");
    console.log();
    console.log(
      "Note: Keep your tokens secure and don't commit them to version control."
    );
  } catch (error) {
    console.error("❌ Authentication failed:", error);
    process.exit(1);
  }
}
