import { fetchCsvText } from "./csv.js";
import { mapRows } from "./mapping.js";
// import { appendToSheet } from "./sheets.ts";

export async function runSync() {
  const csvText = await fetchCsvText();
  const rows = mapRows(csvText); // chuyển CSV → mảng object đã map
  if (!rows.length) {
    console.log("[sync] no rows parsed");
    return;
  }
  console.log(rows);
  //   await appendToSheet(rows); // đẩy lên Google Sheet
}
