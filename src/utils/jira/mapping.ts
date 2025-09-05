import Papa from "papaparse";

export type RowOut = {
  issueKey: string; // Issue key (ABC-123)
  issueId: string; // Jira internal id (numeric/string)
  status: string;
  updatedAt?: string; // ISO
  summary: string;
  issueType: string;
  assignee?: string;
  typeOfWork?: string; // Custom field (Type of Work)
  remainingEstimateSec: number; // seconds
  originalEstimateSec: number; // seconds
  createdAt?: string; // ISO
  dueDate?: string; // ISO (nếu có)
  actualStartAt?: string; // ISO (custom)
  actualEndAt?: string; // ISO (custom)
  planStartAt?: string; // ISO (custom)
  syncedAt: string; // ISO (thời điểm đồng bộ)
  percentDone: number; // Custom field (% Done)
  timeSpentSec: number; // Custom field (Time Spent)
};

// --- helpers -------------------------------------------------------------

const MONTHS_EN = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

// Parse datetime chuỗi Jira phổ biến:
//  - "14/Aug/2025 2:30 PM"
//  - "14/Aug/25 14:30"
//  - hoặc bất cứ thứ gì Date.parse hiểu được
function toISO(input?: string): string | undefined {
  if (!input) return undefined;
  const s = input.trim();
  if (!s) return undefined;

  // Nếu JS hiểu được
  const native = Date.parse(s);
  if (!Number.isNaN(native)) return new Date(native).toISOString();

  // Thử dạng "dd/Mon/yyyy hh:mm AM|PM" hoặc "dd/Mon/yyyy"
  const m = s.match(
    /^(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/
  );
  if (m) {
    const [, ddStr, monStr, yStr, hhStr, miStr, ampm] = m;

    // Add null checks for required groups
    if (!ddStr || !monStr || !yStr) return undefined;

    const d = Number(ddStr);
    const mon = MONTHS_EN[monStr.toLowerCase() as keyof typeof MONTHS_EN];
    let Y = Number(
      yStr.length === 2
        ? Number(yStr) >= 70
          ? "19" + yStr
          : "20" + yStr
        : yStr
    );
    let hh = hhStr ? Number(hhStr) : 0;
    const mi = miStr ? Number(miStr) : 0;

    // xử lý AM/PM
    if (ampm) {
      const up = ampm.toUpperCase();
      if (up === "PM" && hh < 12) hh += 12;
      if (up === "AM" && hh === 12) hh = 0;
    }

    // dùng UTC để đồng nhất
    const date = new Date(Date.UTC(Y, mon, d, hh, mi, 0));
    return date.toISOString();
  }

  // Thử dd/MM/yyyy HH:mm (không month name)
  const m2 = s.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/
  );
  if (m2) {
    const [, dd, mm, yyyy, hh = "00", mi = "00"] = m2;

    // Add null checks for required groups
    if (!dd || !mm || !yyyy) return undefined;

    const Y = Number(yyyy.length === 2 ? "20" + yyyy : yyyy);
    const M = Number(mm) - 1;
    const D = Number(dd);
    const date = new Date(Date.UTC(Y, M, D, Number(hh), Number(mi), 0));
    return date.toISOString();
  }

  return undefined;
}

// Parse thời lượng Jira: "1w 2d 3h 30m" → seconds
function parseJiraDuration(input?: string): number {
  if (!input) return 0;
  const s = input.trim().toLowerCase();
  if (!s) return 0;

  // Một số export Jira có thể đưa số giây trực tiếp -> thử parse số
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  // Mặc định: 1w = 5d (Jira thường dùng 5 ngày / week), 1d = 8h
  // Bạn có thể chỉnh tùy thực tế team:
  const WEEK_DAYS = 5;
  const DAY_HOURS = 8;

  const re = /(\d+(?:\.\d+)?)\s*([wdhm])/g;
  let match: RegExpExecArray | null;
  let seconds = 0;

  while ((match = re.exec(s)) !== null) {
    const value = parseFloat(match[1] || "0");
    const unit = match[2];
    if (!Number.isFinite(value) || !unit) continue;

    switch (unit) {
      case "w":
        seconds += value * WEEK_DAYS * DAY_HOURS * 3600;
        break;
      case "d":
        seconds += value * DAY_HOURS * 3600;
        break;
      case "h":
        seconds += value * 3600;
        break;
      case "m":
        seconds += value * 60;
        break;
    }
  }

  return Math.round(seconds);
}

// --- main mapping --------------------------------------------------------

export function mapRows(csvText: string): RowOut[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });

  if (parsed.errors.length) {
    console.warn("[mapping] csv parse warnings:", parsed.errors.slice(0, 3));
  }

  const now = new Date().toISOString();
  const rows: RowOut[] = [];

  for (const r of parsed.data || []) {
    if (!r) continue;

    const issueKey = (r["Issue key"] || r["Issue Key"] || "").toString().trim();
    const issueId = (r["Issue id"] || r["Issue ID"] || "").toString().trim();
    const status = (r["Status"] || "").toString().trim();
    const summary = (r["Summary"] || "").toString().trim();
    const issueType = (r["Issue Type"] || r["Issue type"] || "")
      .toString()
      .trim();
    const assignee = (r["Assignee"] || "").toString().trim();
    const typeOfWork = (r["Custom field (Type of Work)"] || "")
      .toString()
      .trim();

    const updatedAt = toISO(r["Updated"]);
    const createdAt = toISO(r["Created"]);
    const dueDate = toISO(r["Due Date"]);
    const actualEndAt = toISO(r["Custom field (Actual End Date)"]);
    const actualStartAt = toISO(r["Custom field (Actual Start Date)"]);
    const planStartAt = toISO(r["Custom field (Plan Start Date)"]);

    const remainingEstimateSec = parseJiraDuration(r["Remaining Estimate"]);
    const originalEstimateSec = parseJiraDuration(r["Original Estimate"]);
    const timeSpentSec = parseJiraDuration(r["Time Spent"]);
    const percentDone = Number(
      (r["Custom field (% Done)"]?.toString().replace("%", "") || "0").trim()
    );

    // Bỏ qua dòng thiếu khóa chính (issueKey hoặc issueId)
    if (!issueKey && !issueId) continue;

    const row: RowOut = {
      issueKey,
      issueId,
      status,
      summary,
      issueType,
      remainingEstimateSec,
      originalEstimateSec,
      syncedAt: now,
      percentDone,
      timeSpentSec,
    };

    // Add optional properties only when they have values
    if (updatedAt) row.updatedAt = updatedAt;
    if (assignee) row.assignee = assignee;
    if (typeOfWork) row.typeOfWork = typeOfWork;
    if (createdAt) row.createdAt = createdAt;
    if (dueDate) row.dueDate = dueDate;
    if (actualStartAt) row.actualStartAt = actualStartAt;
    if (actualEndAt) row.actualEndAt = actualEndAt;
    if (planStartAt) row.planStartAt = planStartAt;

    rows.push(row);
  }

  return rows;
}
