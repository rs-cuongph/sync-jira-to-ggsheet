import { GoogleSpreadsheet } from "google-spreadsheet";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import dayjs from "dayjs";
import type { RowOut } from "./mapping.js";

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 500);

// Helper function to format date as YYYY/MM/DD
function formatDateYYYYMMDD(dateString?: string): string {
  if (!dateString) return "";
  try {
    const date = dayjs(dateString);
    if (!date.isValid()) return "";
    return date.format("YYYY/MM/DD");
  } catch {
    return "";
  }
}

// Helper function to format datetime as YYYY/MM/DD HH:mm
function formatDateTimeYYYYMMDDHHMM(dateString?: string): string {
  if (!dateString) return "";
  try {
    const date = dayjs(dateString);
    if (!date.isValid()) return "";
    return date.format("YYYY/MM/DD HH:mm");
  } catch {
    return "";
  }
}

// Helper function to extract username from email
function extractUsernameFromEmail(email?: string): string {
  if (!email) return "";
  const atIndex = email.indexOf("@");
  return atIndex > 0 ? email.substring(0, atIndex) : email;
}

// Helper function to find row by issueKey in column M
async function findRowByIssueKey(
  sheet: any,
  issueKey: string
): Promise<any | null> {
  const rows = await sheet.getRows({ offset: 0, limit: sheet.rowCount });
  for (const row of rows) {
    const rowIssueKey = (row.get("M") || "").toString().trim();
    if (rowIssueKey === issueKey) {
      return row;
    }
  }
  return null;
}

// Helper function to update row with new data
async function updateRow(row: any, data: Partial<RowOut>) {
  if (data.planStartAt !== undefined) {
    row.set("F", formatDateYYYYMMDD(data.planStartAt));
  }
  if (data.dueDate !== undefined) {
    row.set("G", formatDateYYYYMMDD(data.dueDate));
  }
  if (data.actualStartAt !== undefined) {
    row.set("H", formatDateYYYYMMDD(data.actualStartAt));
  }
  if (data.actualEndAt !== undefined) {
    row.set("I", formatDateYYYYMMDD(data.actualEndAt));
  }
  if (data.assignee !== undefined) {
    row.set("K", extractUsernameFromEmail(data.assignee));
  }
  if (data.status !== undefined) {
    row.set("M", data.status);
  }
  if (data.percentDone !== undefined) {
    row.set("L", data.percentDone);
  }
  if (data.syncedAt !== undefined) {
    row.set("P", formatDateTimeYYYYMMDDHHMM(data.syncedAt));
  }

  await row.save();
}

async function openDoc() {
  // OAuth2 configuration
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback"
  );

  // Set credentials from environment variables or token file
  const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (accessToken && refreshToken) {
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } else {
    throw new Error(
      "Google OAuth2 credentials not found. Please set GOOGLE_ACCESS_TOKEN and GOOGLE_REFRESH_TOKEN environment variables."
    );
  }

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, oauth2Client);

  await doc.loadInfo();
  return doc;
}

async function ensureSheet(
  doc: GoogleSpreadsheet,
  title: string,
  headers: string[]
) {
  const sheet =
    doc.sheetsByTitle[title] ||
    (await doc.addSheet({ title, headerValues: headers }));
  if (!sheet.headerValues?.length) await sheet.setHeaderRow(headers);
  return sheet;
}

export async function appendToSheetIdempotent(rows: RowOut[]) {
  if (!rows.length) return { written: 0, updated: 0 };

  const doc = await openDoc();
  const mainName = process.env.GOOGLE_SHEET_TAB || "Data";

  // Define headers for the new column structure
  const headers = [
    "A",
    "B",
    "C",
    "D",
    "E", // A-E columns
    "F", // planStartAt
    "G", // dueDate
    "H", // actualStartAt
    "I", // actualEndAt
    "J", // J column
    "K", // assignee
    "L", // percentDone
    "M", // issueKey (primary key) + status
    "N",
    "O", // N-O columns
    "P", // syncedAt
  ];

  const main = await ensureSheet(doc, mainName, headers);

  let written = 0;
  let updated = 0;

  for (const row of rows) {
    // Try to find existing row by issueKey in column M
    const existingRow = await findRowByIssueKey(main, row.issueKey);

    if (existingRow) {
      // Update existing row
      await updateRow(existingRow, row);
      updated++;
    } else {
      // Add new row
      await main.addRow({
        M: row.issueKey, // Primary key in column M
        F: formatDateYYYYMMDD(row.planStartAt),
        G: formatDateYYYYMMDD(row.dueDate),
        H: formatDateYYYYMMDD(row.actualStartAt),
        I: formatDateYYYYMMDD(row.actualEndAt),
        K: extractUsernameFromEmail(row.assignee),
        L: row.percentDone,
        P: formatDateTimeYYYYMMDDHHMM(row.syncedAt),
      });
      written++;
    }
  }

  return { written, updated };
}
