import { chromium, type Browser, type Page } from "playwright";
import { config } from "dotenv";

config();

interface JiraCredentials {
  username: string;
  password: string;
}

export class JiraAuthenticator {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly jiraUrl = process.env.JIRA_URL!;

  async getCookieString(): Promise<string> {
    const username = process.env.JIRA_USERNAME;
    const password = process.env.JIRA_PASSWORD;

    if (!username || !password) {
      throw new Error(
        "JIRA_USERNAME and JIRA_PASSWORD environment variables are required"
      );
    }

    try {
      await this.initialize();
      return await this.login({ username, password });
    } finally {
      await this.close();
    }
  }

  private async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    this.page = await this.browser.newPage();
    await this.page.context().setExtraHTTPHeaders({
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
  }

  private async login(credentials: JiraCredentials): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized");

    await this.page.goto(this.jiraUrl, { waitUntil: "networkidle" });

    await this.page
      .getByRole("textbox", { name: "Username" })
      .fill(credentials.username);

    await this.page
      .getByRole("textbox", { name: "Password" })
      .fill(credentials.password);

    await this.page.getByText("Remember my login on this").click();

    await this.page.getByRole("button", { name: "Log In" }).click();

    // Wait for successful login
    try {
      await this.page.waitForURL((url: URL) => !url.pathname.includes("login"));
    } catch (error) {
      console.error("❌ Login failed:", error);
      const currentUrl = this.page.url();
      if (currentUrl.includes("login") || currentUrl.includes("auth")) {
        throw new Error("Login failed - invalid credentials");
      }
    }

    return this.extractSessionCookies();
  }

  private async extractSessionCookies(): Promise<string> {
    if (!this.page) throw new Error("Page not available");

    const allCookies = await this.page.context().cookies();

    const sessionCookies = allCookies.filter(
      (cookie) =>
        cookie.name.toLowerCase().includes("session") ||
        cookie.name.toLowerCase().includes("jsessionid") ||
        cookie.name.toLowerCase().includes("xsrf") ||
        cookie.name.toLowerCase().includes("atlassian")
    );

    const cookies = sessionCookies.length > 0 ? sessionCookies : allCookies;
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  }

  private async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
