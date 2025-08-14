import { fetchCsvText } from "./csv.js";
import { mapRows } from "./mapping.js";
import { appendToSheetIdempotent } from "./sheets.js";

export async function runSync() {
  const csvText = await fetchCsvText();
  const rows = mapRows(csvText); // chuyển CSV → mảng object đã map
  if (!rows.length) {
    console.log("[sync] no rows parsed");
    return;
  }
  const { updated } = await appendToSheetIdempotent(rows); // đẩy lên Google Sheet
  console.log(`[sync] updated ${updated} rows`);
}
