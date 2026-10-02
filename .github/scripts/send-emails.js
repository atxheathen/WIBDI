// Sends the Daily and (Wednesday-only) Weekly digest emails via Resend.
//
// Daily: whatever entry matches today's date (Pacific calendar day),
// falling back to the most recent entry if today has no row yet — same
// fallback behavior as the website itself.
//
// Weekly: only runs on Wednesdays. Looks up *today's own row* in the sheet,
// reads its "Weekly Email" column (a date), then sends the content entry
// for THAT date — the sheet's "Weekly Email" column is the lookup table,
// not the content itself.
//
// Set TEST_EMAIL to send both emails only to that address via the regular
// transactional API (bypassing Resend's segment/topic broadcast) instead of
// sending to real subscribers — this is the dry-run path.

const fs = require("fs");
const path = require("path");

const STATE_FILE = path.join(__dirname, "state.json");

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SHEET_CSV_URL = process.env.SHEET_CSV_URL;
const FROM_ADDRESS = process.env.FROM_ADDRESS || "What If Biden Did It? <email@whatifbidendidit.com>";
const TEST_EMAIL = process.env.TEST_EMAIL || "";

const GENERAL_SEGMENT_ID = "bc3b13b8-fa28-4d1f-a5c5-9c02409b2298";
const DAILY_TOPIC_ID = "221e36bc-2cf9-4e51-ba33-58968ebda649";
const WEEKLY_TOPIC_ID = "ed722da3-4e00-4829-a7ed-ff27ecf1fadd";

const COLUMNS = {
  date: ["date"],
  category: ["category"],
  headline: ["headline", "title"],
  bidenFrame: ["what if biden did it", "biden frame", "reframe"],
  source: ["source url", "source", "link"],
  urlDate: ["url date"],
  urlOrg: ["url new org", "url org", "news org"],
  urlTitle: ["url article title"],
  weeklyEmail: ["weekly email"],
};

// --- CSV parsing (ported from js/data.js) ---

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function matchColumn(header) {
  const normalized = header.trim().toLowerCase();
  for (const [key, aliases] of Object.entries(COLUMNS)) {
    if (aliases.includes(normalized)) return key;
  }
  return null;
}

function normalizeDate(raw) {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return trimmed;
}

function rowsToRecords(rows) {
  if (rows.length === 0) return [];
  const headerMap = rows[0].map(matchColumn);
  return rows.slice(1).map((row) => {
    const record = {};
    row.forEach((cell, i) => {
      const key = headerMap[i];
      if (key) record[key] = cell.trim();
    });
    if (record.date) record.date = normalizeDate(record.date);
    if (record.weeklyEmail) record.weeklyEmail = normalizeDate(record.weeklyEmail);
    return record;
  });
}

function escapeHTML(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDateForDisplay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateSafe(raw) {
  if (!raw) return "";
  const iso = normalizeDate(raw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return raw;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// --- Pacific time helpers ---

function pacificParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);
  const map = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });
  return {
    iso: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour) % 24,
    weekday: map.weekday,
  };
}

// --- Email template ---

function renderCitation(entry) {
  if (!entry.source) return "";
  const hasFullCitation = entry.urlOrg && entry.urlTitle;
  const label = hasFullCitation
    ? `${formatDateSafe(entry.urlDate)} &mdash; ${escapeHTML(entry.urlOrg)}: &ldquo;${escapeHTML(entry.urlTitle)}&rdquo;`
    : escapeHTML(extractDomain(entry.source));

  return `
    <tr><td style="padding:0 32px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff6a8;border-radius:4px;">
        <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;">
          <p style="margin:0 0 6px;font-size:20px;font-weight:bold;text-transform:uppercase;color:#2c2416;">What Trump Did</p>
          <p style="margin:0;font-size:13px;line-height:1.5;"><a href="${escapeHTML(entry.source)}" style="color:#b3261e;">${label}</a></p>
        </td></tr>
      </table>
    </td></tr>
  `;
}

function renderEmailHTML(entry) {
  const categoryRow = entry.category
    ? `<p style="margin:16px 0 4px;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#b3261e;font-family:Arial,Helvetica,sans-serif;">${escapeHTML(entry.category)}</p>`
    : `<div style="height:16px;"></div>`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#a9773f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#a9773f;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#fffdf2;border-radius:8px;">
          <tr><td style="padding:32px 32px 0;font-family:Rockwell,'Rockwell Nova','Courier New',serif;">
            <p style="margin:0;font-size:38px;line-height:1.1;font-weight:bold;color:#2c2416;">What If Biden Did It?</p>
          </td></tr>
          <tr><td style="padding:0 32px;">
            ${categoryRow}
            <p style="margin:0 0 16px;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#7a6a50;font-family:Arial,Helvetica,sans-serif;">${formatDateForDisplay(entry.date)}</p>
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#2c2416;font-family:Arial,Helvetica,sans-serif;font-weight:800;">${escapeHTML(entry.headline)}</h1>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#2c2416;font-family:Arial,Helvetica,sans-serif;">${escapeHTML(entry.bidenFrame)}</p>
          </td></tr>
          ${renderCitation(entry)}
          <tr><td style="padding:24px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7a6a50;text-align:center;border-top:1px solid #e8dfc5;">
            <p style="margin:16px 0 8px;">Satire and commentary. Not affiliated with any campaign, party, or candidate.</p>
            <p style="margin:0;"><a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#7a6a50;">Unsubscribe</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

// --- Resend API calls ---

async function sendTestEmail(entry, subject) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: TEST_EMAIL,
      subject: `[TEST] ${subject}`,
      html: renderEmailHTML(entry).replace(
        "{{{RESEND_UNSUBSCRIBE_URL}}}",
        "#test-mode-no-real-unsubscribe-link"
      ),
    }),
  });
  if (!res.ok) throw new Error(`Test email failed: ${await res.text()}`);
  console.log(`Sent TEST email to ${TEST_EMAIL}: ${subject}`);
}

async function sendBroadcast(entry, subject, topicId) {
  const res = await fetch("https://api.resend.com/broadcasts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      segment_id: GENERAL_SEGMENT_ID,
      topic_id: topicId,
      from: FROM_ADDRESS,
      subject,
      html: renderEmailHTML(entry),
      send: true,
    }),
  });
  if (!res.ok) throw new Error(`Broadcast failed: ${await res.text()}`);
  const data = await res.json();
  console.log(`Sent broadcast ${data.id}: ${subject}`);
}

// --- Main ---

async function main() {
  const isTest = Boolean(TEST_EMAIL);
  const { iso: today, hour, weekday } = pacificParts();
  const state = isTest ? {} : loadState();
  let stateChanged = false;

  // Widened morning window (not just "exactly 7am") since GitHub's cron
  // schedule is best-effort and can fire late — the state file below is
  // what actually prevents double-sends, not this window.
  if (!isTest && (hour < 6 || hour > 11)) {
    console.log(`Outside the morning send window (currently ${hour}:00 Pacific) — exiting without sending.`);
    return;
  }

  const csvText = await fetch(SHEET_CSV_URL).then((r) => r.text());
  const records = rowsToRecords(parseCSV(csvText));

  const recordsByDate = {};
  records.forEach((r) => {
    if (r.date) recordsByDate[r.date] = r;
  });

  const contentEntries = records
    .filter((r) => r.date && r.headline)
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

  // --- Daily ---
  if (!isTest && state.lastDailySent === today) {
    console.log(`Daily already sent today (${today}) — skipping.`);
  } else {
    const dailyEntry = recordsByDate[today] && recordsByDate[today].headline
      ? recordsByDate[today]
      : contentEntries[0];

    if (!dailyEntry) {
      console.log("No entries at all — nothing to send.");
    } else {
      const subject = dailyEntry.headline;
      if (isTest) {
        await sendTestEmail(dailyEntry, `[DAILY] ${subject}`);
      } else {
        await sendBroadcast(dailyEntry, subject, DAILY_TOPIC_ID);
        state.lastDailySent = today;
        stateChanged = true;
      }
    }
  }

  // --- Weekly (Wednesdays only, or always in test mode so it can be verified) ---
  if (isTest || weekday === "Wed") {
    if (!isTest && state.lastWeeklySent === today) {
      console.log(`Weekly already sent today (${today}) — skipping.`);
    } else {
      const todayRow = recordsByDate[today];
      const weeklyDate = todayRow && todayRow.weeklyEmail;
      const weeklyEntry = weeklyDate ? recordsByDate[weeklyDate] : null;

      if (!weeklyEntry || !weeklyEntry.headline) {
        console.log(
          `Weekly send skipped: no "Weekly Email" lookup date set for today, or no entry found for that date (looked for ${weeklyDate || "nothing"}).`
        );
      } else {
        const subject = `This Week: ${weeklyEntry.headline}`;
        if (isTest) {
          await sendTestEmail(weeklyEntry, `[WEEKLY] ${subject}`);
        } else {
          await sendBroadcast(weeklyEntry, subject, WEEKLY_TOPIC_ID);
          state.lastWeeklySent = today;
          stateChanged = true;
        }
      }
    }
  }

  if (stateChanged) saveState(state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
