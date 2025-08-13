import { fetch } from "undici";
import Papa from "papaparse";

export async function fetchCsvText(): Promise<string> {
  const url = process.env.CSV_URL!;
  console.log("url", url);
  const headers: Record<string, string> = {};
  if (process.env.CSV_COOKIE) headers["cookie"] = process.env.CSV_COOKIE;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Download failed ${res.status}: ${body.slice(0, 200)}`);
  }

  // Trường hợp “mở link trên browser là tải file”: server thường trả về CSV với
  // Content-Disposition: attachment. Ở server mình cứ đọc body text là đủ.
  const text = await res.text();
  if (!text.trim().length) throw new Error("Empty CSV");
  return text;
}
