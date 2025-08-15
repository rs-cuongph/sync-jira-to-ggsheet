import { fetchCsvText } from "./csv.js";
import { mapRows } from "./mapping.js";
import { appendToSheetIdempotent } from "./sheets.js";

const sheets = ["WBS_DEV", "WBS_QC"];

export async function runSync() {
  const csvText = await fetchCsvText();
  const rows = mapRows(csvText); // chuyển CSV → mảng object đã map
  if (!rows.length) {
    console.log("[sync] no rows parsed");
    return;
  }

  for (const sheet of sheets) {
    const { updated } = await appendToSheetIdempotent(rows, sheet); // đẩy lên Google Sheet
    console.log(`[sync] updated ${updated} rows to ${sheet}`);
  }

  return { success: true };
}
