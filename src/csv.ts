import { fetch } from "undici";
import { CookieManager } from "./cookie-manager.js";

export async function fetchCsvText(): Promise<string> {
  const url = process.env.CSV_URL!;
  console.log("url", url);

  const cookieManager = new CookieManager();
  let cookie: string | null = null;

  try {
    cookie = await cookieManager.getCookie();
  } catch (error) {
    console.error("❌ Failed to get Jira session cookie:", error);
    console.log("⚠️ Proceeding without authentication cookie");
  }

  const headers: Record<string, string> = {};
  if (cookie) {
    headers["cookie"] = cookie;
    console.log("🍪 Using authentication cookie");
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Download failed ${res.status}: ${body.slice(0, 200)}`);
  }

  const text = await res.text();
  if (!text.trim().length) throw new Error("Empty CSV");
  return text;
}

export async function getJiraCookie(): Promise<string> {
  const cookieManager = new CookieManager();
  return await cookieManager.getCookie();
}

export async function clearJiraCookie(): Promise<void> {
  const cookieManager = new CookieManager();
  cookieManager.clearCookie();
}
