import {
  GoogleSpreadsheet,
  GoogleSpreadsheetWorksheet,
} from "google-spreadsheet";
import dayjs from "dayjs";
import type { RowOut } from "../../utils/jira/mapping.js";
import { GoogleOAuth2Manager } from "../../utils/ggsheet/oauth.js";
import { RateLimiter } from "../../utils/rate-limiter.js";
import { RetryManager } from "../../utils/retry.js";
import { GoogleAPIErrorHandler } from "../../utils/ggsheet/google-api-error-handler.js";
import { GoogleAPIQuotaMonitor } from "../../utils/ggsheet/quota-monitor.js";

// Initialize rate limiter, retry manager, and quota monitor for batch operations
const rateLimiter = new RateLimiter(1000, 1000, 100); // 1s between batches, 1000 rows per batch
const retryManager = new RetryManager({
  maxRetries: 5, // Increased from 3 to 5 for quota errors
  baseDelay: 2000, // Increased from 1s to 2s base delay
  maxDelay: 60000, // Increased from 30s to 60s max delay
  backoffMultiplier: 2,
  jitter: true, // Enable jitter to prevent thundering herd
});
const quotaMonitor = new GoogleAPIQuotaMonitor();

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

// Helper function to create a map of existing rows by issueKey using batch operations
async function createIssueKeyMap(
  sheet: GoogleSpreadsheetWorksheet
): Promise<Map<string, any>> {
  const issueKeyMap = new Map<string, any>();

  // Check if sheet has any data
  if (sheet.rowCount === 0) {
    return issueKeyMap;
  }

  // Use batchGet to load all rows at once (much more efficient)
  const loadRowsWithRetry = async () => {
    return await rateLimiter.execute(async () => {
      return await retryManager.execute(async () => {
        // Use getRows but with optimized loading
        return await sheet.getRows();
      });
    });
  };

  const rows = await loadRowsWithRetry();

  // Process rows efficiently
  for (const row of rows) {
    const issueKey = (row.get("Issue Key") || "").toString().trim();
    const status = (row.get("Status") || "").toString().trim();
    const lastSync = (row.get("Last Sync") || "").toString().trim();
    let canUpdate = false;

    if (status === "Closed") {
      continue;
    }

    if (lastSync) {
      const syncedAt = formatDateTimeYYYYMMDDHHMM(lastSync);
      const syncedAtDate = dayjs(syncedAt);
      const now = dayjs();
      // kiểm tra nếu last sync cách hôm nay 1 giờ thì có thể update
      canUpdate =
        syncedAtDate.isValid() &&
        syncedAtDate.isBefore(now.subtract(1, "hour"));
    } else {
      canUpdate = true;
    }

    if (canUpdate) {
      issueKeyMap.set(issueKey, row);
    }
  }

  return issueKeyMap;
}

// Helper function to update row with new data (prepare for batch update)
function updateRow(row: any, data: Partial<RowOut>) {
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

  if (data.status === "Resolved" || data.status === "Closed") {
    row.set("Progress (%)", 100);
  } else if (data.status === "In Progress") {
    if (data.percentDone !== undefined) {
      row.set("Progress (%)", data.percentDone ?? 0);
    }
  } else if (data.status === "In Review") {
    row.set("Progress (%)", 80);
  }

  if (data.syncedAt !== undefined) {
    row.set("Last Sync", formatDateTimeYYYYMMDDHHMM(data.syncedAt));
  }

  // Return the updated row for batch processing
  return row;
}

// Helper function to save all updated rows in batch
async function saveRowsInBatch(rows: any[]) {
  if (rows.length === 0) return;

  console.log(`[sheets] Starting batch save of ${rows.length} rows...`);
  
  // Use smaller batch sizes to avoid overwhelming Google API
  const batchSize = 50; // Reduced from 1000 to 50 for better quota management
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(rows.length / batchSize);
    
    console.log(`[sheets] Processing batch ${batchNumber}/${totalBatches} with ${batch.length} rows...`);
    
    try {
      // Use batch operations with rate limiting
      await rateLimiter.execute(async () => {
        return await retryManager.execute(async () => {
          // Save all rows in parallel within the batch
          const savePromises = batch.map((row) => row.save());
          return await Promise.all(savePromises);
        });
      });
      
      console.log(`[sheets] Successfully saved batch ${batchNumber}/${totalBatches}`);
      
      // Add small delay between batches to be respectful to Google API
      if (i + batchSize < rows.length) {
        console.log(`[sheets] Waiting 2 seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error: any) {
      // Use Google API error handler for better error classification and logging
      GoogleAPIErrorHandler.logError(error, 'sheets');
      
      // Record quota error for monitoring
      if (error.status === 429 || error.code === 429 || 
          (error.message && error.message.toLowerCase().includes('quota'))) {
        quotaMonitor.recordQuotaError(error, 'sheets');
        
        // Check if we should pause operations
        if (quotaMonitor.shouldPauseOperations()) {
          const pauseDuration = quotaMonitor.getRecommendedPauseDuration();
          console.warn(`[sheets] QUOTA EXHAUSTED - Pausing operations for ${Math.round(pauseDuration / 1000 / 60)} minutes`);
          console.warn(`[sheets] Estimated quota reset time: ${quotaMonitor.analyzeQuotaStatus().estimatedResetTime?.toISOString()}`);
        }
      }
      
      console.error(`[sheets] Error saving batch ${batchNumber}/${totalBatches}:`, {
        error: error.message || error,
        status: error.status,
        code: error.code,
        batchSize: batch.length,
        remainingRows: rows.length - i
      });
      
      // Log rate limiter status for debugging
      console.log(`[sheets] Rate limiter status:`, rateLimiter.getStatus());
      
      // Log quota monitor status
      console.log(`[sheets] Quota monitor status:`, quotaMonitor.getStats());
      
      // Re-throw error to be handled by caller
      throw error;
    }
  }
  
  console.log(`[sheets] Completed batch save of all ${rows.length} rows`);
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

export async function appendToSheetIdempotent(
  rows: RowOut[],
  sheetName: string
) {
  if (!rows.length || !sheetName) return { written: 0, updated: 0 };

  const doc = await openDoc();

  const sheet = doc.sheetsByTitle[sheetName];

  if (!sheet) throw new Error(`Sheet ${sheetName} not found`);

  // Load sheet headers to understand column structure
  await sheet.loadHeaderRow();

  // Create a map of existing rows by issueKey for efficient lookup
  const issueKeyMap = await createIssueKeyMap(sheet);

  let updated = 0;
  const rowsToUpdate: any[] = [];

  // Process rows and prepare for batch update
  for (const row of rows) {
    const existingRow = issueKeyMap.get(row.issueKey);

    if (existingRow) {
      // Update row data (but don't save yet)
      const updatedRow = updateRow(existingRow, row);
      rowsToUpdate.push(updatedRow);
      updated++;
    }
  }

  // Save all updated rows in batch for better performance
  if (rowsToUpdate.length > 0) {
    console.log(`[sheets] Saving ${rowsToUpdate.length} rows in batch...`);
    await saveRowsInBatch(rowsToUpdate);
    console.log(
      `[sheets] Successfully saved ${rowsToUpdate.length} rows in batch`
    );
  }

  return { updated };
}
