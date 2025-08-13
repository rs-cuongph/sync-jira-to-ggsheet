// import { GoogleSpreadsheet } from "google-spreadsheet";
// import { JWT } from "google-auth-library";
// // import type { RowOut } from "./mapping.js";

// const STATE_TAB = "_SYNC_STATE_";
// const BATCH_SIZE = Number(process.env.BATCH_SIZE || 500);

// async function openDoc() {
//   const doc = new GoogleSpreadsheet(
//     process.env.GOOGLE_SHEET_ID!,
//     new JWT({
//       email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
//       key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
//       scopes: ["https://www.googleapis.com/auth/spreadsheets"],
//     })
//   );
//   await doc.loadInfo();
//   return doc;
// }

// async function ensureSheet(
//   doc: GoogleSpreadsheet,
//   title: string,
//   headers: string[]
// ) {
//   const sheet =
//     doc.sheetsByTitle[title] ||
//     (await doc.addSheet({ title, headerValues: headers }));
//   if (!sheet.headerValues?.length) await sheet.setHeaderRow(headers);
//   return sheet;
// }

// async function getSyncedIdSet(doc: GoogleSpreadsheet): Promise<Set<string>> {
//   const state = await ensureSheet(doc, STATE_TAB, ["id", "lastSyncedAt"]);
//   const rows = await state.getRows({ offset: 0, limit: state.rowCount }); // chú ý: google-spreadsheet đọc paging
//   const set = new Set<string>();
//   for (const r of rows) {
//     const id = (r.get("id") || "").toString().trim();
//     if (id) set.add(id);
//   }
//   return set;
// }

// async function appendSyncState(
//   doc: GoogleSpreadsheet,
//   ids: { id: string; when: string }[]
// ) {
//   if (!ids.length) return;
//   const state = await ensureSheet(doc, STATE_TAB, ["id", "lastSyncedAt"]);
//   // ghi batch
//   for (let i = 0; i < ids.length; i += BATCH_SIZE) {
//     const chunk = ids.slice(i, i + BATCH_SIZE);
//     await state.addRows(chunk.map((x) => ({ id: x.id, lastSyncedAt: x.when })));
//   }
// }

// export async function appendToSheetIdempotent(rows: RowOut[]) {
//   if (!rows.length) return { written: 0, skipped: 0 };

//   const doc = await openDoc();
//   const mainName = process.env.GOOGLE_SHEET_TAB || "Data";
//   const main = await ensureSheet(doc, mainName, [
//     "id",
//     "name",
//     "email",
//     "amount",
//     "updatedAt",
//     "syncedAt",
//   ]);

//   // Idempotency: bỏ qua id đã sync
//   const synced = await getSyncedIdSet(doc);
//   const fresh = rows.filter((r) => !synced.has(r.id));

//   // Batch ghi dữ liệu chính
//   let written = 0;
//   for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
//     const chunk = fresh.slice(i, i + BATCH_SIZE);
//     await main.addRows(
//       chunk.map((r) => ({
//         id: r.id,
//         name: r.name,
//         email: r.email,
//         amount: r.amount,
//         updatedAt: r.updatedAt || "",
//         syncedAt: r.syncedAt,
//       }))
//     );
//     written += chunk.length;
//   }

//   // Cập nhật state
//   await appendSyncState(
//     doc,
//     fresh.map((r) => ({ id: r.id, when: r.syncedAt }))
//   );

//   return { written, skipped: rows.length - written };
// }
