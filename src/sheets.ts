import {
  GoogleSpreadsheet,
  GoogleSpreadsheetWorksheet,
} from "google-spreadsheet";
import dayjs from "dayjs";
import type { RowOut } from "./mapping.js";
import { GoogleOAuth2Manager } from "./oauth.js";
import { RateLimiter } from "./rate-limiter.js";
import { RetryManager } from "./retry.js";

// Initialize rate limiter and retry manager
const rateLimiter = new RateLimiter(200); // 200ms between API calls
const retryManager = new RetryManager({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
});

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

// Helper function to get column letter from column name
function getColumnLetter(columnName: string, headers: string[]): string | null {
  const index = headers.indexOf(columnName);
  if (index === -1) return null;
  return String.fromCharCode(65 + index); // A=0, B=1, C=2, etc.
}

// Helper function to create a map of existing rows by issueKey
async function createIssueKeyMap(
  sheet: GoogleSpreadsheetWorksheet
): Promise<Map<string, any>> {
  const issueKeyMap = new Map<string, any>();

  // Check if sheet has any data
  if (sheet.rowCount === 0) {
    return issueKeyMap;
  }

  // Load all rows at once to minimize API calls
  const loadRowsWithRetry = async () => {
    return await rateLimiter.execute(async () => {
      return await retryManager.execute(async () => {
        return await sheet.getRows();
      });
    });
  };

  const rows = await loadRowsWithRetry();

  for (const row of rows) {
    const issueKey = (row.get("Issue Key") || "").toString().trim();
    const lastSync = (row.get("Last Sync") || "").toString().trim();
    let canUpdate = false;

    if (lastSync) {
      const syncedAt = formatDateTimeYYYYMMDDHHMM(lastSync);
      const syncedAtDate = dayjs(syncedAt);
      // kiểm tra nếu last sync cách hôm nay 1 giờ thì có thể update
      canUpdate =
        syncedAtDate.isValid() &&
        syncedAtDate.isAfter(dayjs().subtract(1, "hour"));
    } else {
      canUpdate = true;
    }

    if (canUpdate) {
      issueKeyMap.set(issueKey, row);
    }
  }

  return issueKeyMap;
}

// Helper function to update row with new data
async function updateRow(row: any, data: Partial<RowOut>) {
  if (data.planStartAt !== undefined) {
    row.set("Plan Start", formatDateYYYYMMDD(data.planStartAt));
  }

  if (data.dueDate !== undefined) {
    row.set("Plan End", formatDateYYYYMMDD(data.dueDate));
  }

  if (data.actualStartAt !== undefined) {
    row.set("Actual Start", formatDateYYYYMMDD(data.actualStartAt));
  }

  if (data.actualEndAt !== undefined) {
    row.set("Actual End", formatDateYYYYMMDD(data.actualEndAt));
  }

  if (data.assignee !== undefined) {
    row.set("Pic", extractUsernameFromEmail(data.assignee));
  }

  if (data.status !== undefined) {
    row.set("Status", data.status);
  }

  // if (data.percentDone !== undefined) {
  //   row.set("Progress (%)", data.percentDone);
  // }

  if (data.syncedAt !== undefined) {
    row.set("Last Sync", formatDateTimeYYYYMMDDHHMM(data.syncedAt));
  }

  // Use rate limiter and retry for saving
  await rateLimiter.execute(async () => {
    return await retryManager.execute(async () => {
      return await row.save();
    });
  });
}

async function openDoc() {
  // Use GoogleOAuth2Manager for authentication
  const oauthManager = new GoogleOAuth2Manager();
  const oauth2Client = await oauthManager.getAuthenticatedClient();

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, oauth2Client);

  // Use retry mechanism for loading document info
  await retryManager.execute(async () => {
    return await doc.loadInfo();
  });

  return doc;
}

export async function appendToSheetIdempotent(rows: RowOut[]) {
  if (!rows.length) return { written: 0, updated: 0 };

  const doc = await openDoc();
  const mainName = process.env.GOOGLE_SHEET_TAB || "Data";

  const sheet = doc.sheetsByTitle[mainName];

  if (!sheet) throw new Error(`Sheet ${mainName} not found`);

  // Load sheet headers to understand column structure
  await sheet.loadHeaderRow();

  // Create a map of existing rows by issueKey for efficient lookup
  const issueKeyMap = await createIssueKeyMap(sheet);

  let updated = 0;

  // Process rows sequentially to avoid overwhelming the API
  for (const row of rows) {
    const existingRow = issueKeyMap.get(row.issueKey);

    if (existingRow) {
      // Update existing row with rate limiting
      await updateRow(existingRow, row);
      updated++;
    }
  }

  return { updated };
}
