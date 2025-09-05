import { fetchCsvText } from "./csv.js";
import { mapRows } from "../../utils/jira/mapping.js";
import { appendToSheetIdempotent } from "./sheets.js";

export async function syncJira2Sheet() {
  const sheets = ["WBS_DEV", "WBS_QC"];
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

export async function syncOrEstimateAndTimeSpent() {
  const sheets = ["WBS_DEV"];
  const csvText = await fetchCsvText();
  const rows = mapRows(csvText); // chuyển CSV → mảng object đã map
  if (!rows.length) {
    console.log("[sync] no rows parsed");
    return;
  }

  for (const sheet of sheets) {
    const { updated } = await appendToSheetIdempotent(rows, sheet, true); // đẩy lên Google Sheet
    console.log(`[sync] updated ${updated} rows to ${sheet}`);
  }

  return { success: true };
}
