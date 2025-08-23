import fs from "fs";
import path from "path";
import { JiraAuthenticator } from "./jira-auth.js";

interface CookieData {
  cookie_string: string;
  expires_at: number;
  created_at: number;
  domain: string;
}

const COOKIE_PATH = path.join(process.cwd(), "jira-cookie.json");
const COOKIE_EXPIRY_HOURS = 24; // Cookies typically expire after 24 hours

export class CookieManager {
  /**
   * Load cookie from JSON file
   */
  async loadCookie(): Promise<string | null> {
    try {
      if (fs.existsSync(COOKIE_PATH)) {
        const cookieData: CookieData = JSON.parse(
          fs.readFileSync(COOKIE_PATH, "utf8")
        );

        // Check if cookie is still valid
        if (Date.now() < cookieData.expires_at) {
          console.log("🍪 Using cached Jira session cookie");
          return cookieData.cookie_string;
        } else {
          console.log("⚠️ Cached cookie has expired");
          return null;
        }
      }
    } catch (error) {
      console.warn("Failed to load cookie from file:", error);
    }
    return null;
  }

  /**
   * Save cookie to JSON file
   */
  async saveCookie(cookieString: string, domain: string): Promise<void> {
    const cookieData: CookieData = {
      cookie_string: cookieString,
      expires_at: Date.now() + COOKIE_EXPIRY_HOURS * 60 * 60 * 1000, // 24 hours from now
      created_at: Date.now(),
      domain: domain,
    };

    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookieData, null, 2));
    console.log("🍪 Cookie saved to", COOKIE_PATH);
  }

  /**
   * Get fresh cookie by authenticating with Jira
   */
  async getFreshCookie(): Promise<string> {
    console.log("🔐 Getting fresh Jira session cookie...");
    const authenticator = new JiraAuthenticator();
    const cookieString = await authenticator.getCookieString();

    // Extract domain from JIRA_URL
    const domain = new URL(process.env.JIRA_URL!).hostname;
    await this.saveCookie(cookieString, domain);

    return cookieString;
  }

  /**
   * Get cookie (cached or fresh)
   */
  async getCookie(): Promise<string> {
    // Try to load cached cookie first
    const cachedCookie = await this.loadCookie();
    if (cachedCookie) {
      return cachedCookie;
    }

    // Get fresh cookie if cached one is invalid or doesn't exist
    return await this.getFreshCookie();
  }

  /**
   * Clear cached cookie
   */
  clearCookie(): void {
    if (fs.existsSync(COOKIE_PATH)) {
      fs.unlinkSync(COOKIE_PATH);
      console.log("🗑️ Cached cookie cleared");
    }
  }

  /**
   * Check if cookie file exists and is valid
   */
  hasValidCookie(): boolean {
    try {
      if (!fs.existsSync(COOKIE_PATH)) {
        return false;
      }

      const cookieData: CookieData = JSON.parse(
        fs.readFileSync(COOKIE_PATH, "utf8")
      );
      return Date.now() < cookieData.expires_at;
    } catch {
      return false;
    }
  }
}
