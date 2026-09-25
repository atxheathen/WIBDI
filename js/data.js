// Shared helpers: fetch the published Google Sheet as CSV, parse it,
// and find the entry that matches a given date.

const COLUMNS = {
  date: ["date"],
  headline: ["headline", "title"],
  trumpAction: ["what trump did", "trump action", "the action"],
  bidenFrame: ["what if biden did it", "biden frame", "reframe"],
  source: ["source url", "source", "link"],
};

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

  // Already ISO (YYYY-MM-DD) — preferred format for your sheet's Date column.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Fallback: M/D/YYYY or MM/DD/YYYY (what Sheets exports if the column is a real Date type).
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return trimmed;
}

function rowsToEntries(rows) {
  if (rows.length === 0) return [];

  const headerMap = rows[0].map(matchColumn);

  return rows
    .slice(1)
    .map((row) => {
      const entry = {};
      row.forEach((cell, i) => {
        const key = headerMap[i];
        if (key) entry[key] = cell.trim();
      });
      if (entry.date) entry.date = normalizeDate(entry.date);
      return entry;
    })
    .filter((entry) => entry.date && entry.headline);
}

async function fetchEntries() {
  if (!CONFIG.SHEET_CSV_URL || CONFIG.SHEET_CSV_URL.startsWith("PASTE_")) {
    throw new Error(
      "No sheet connected yet. Set SHEET_CSV_URL in js/config.js — see SETUP.md."
    );
  }

  const res = await fetch(CONFIG.SHEET_CSV_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Could not load the sheet (HTTP ${res.status}).`);
  }

  const text = await res.text();
  const entries = rowsToEntries(parseCSV(text));
  entries.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  return entries;
}

function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateForDisplay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function renderEntryCard(entry) {
  const sourceLink = entry.source
    ? `<p class="entry-source"><a href="${escapeHTML(entry.source)}" target="_blank" rel="noopener">Source</a></p>`
    : "";

  return `
    <article class="entry-card">
      <p class="entry-date">${formatDateForDisplay(entry.date)}</p>
      <h2 class="entry-headline">${escapeHTML(entry.headline)}</h2>
      <div class="entry-block">
        <h3>What Trump Did</h3>
        <p>${escapeHTML(entry.trumpAction)}</p>
      </div>
      <div class="entry-block">
        <h3>What If Biden Did It?</h3>
        <p>${escapeHTML(entry.bidenFrame)}</p>
      </div>
      ${sourceLink}
    </article>
  `;
}
