// Shared helpers: fetch the published Google Sheet as CSV, parse it,
// and find the entry that matches a given date.

const COLUMNS = {
  date: ["date"],
  category: ["category"],
  headline: ["headline", "title"],
  bidenFrame: ["what if biden did it", "biden frame", "reframe"],
  source: ["source url", "source", "link"],
  urlDate: ["url date"],
  urlOrg: ["url new org", "url org", "news org"],
  urlTitle: ["url article title"],
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
      if (entry.urlDate) entry.urlDate = normalizeDate(entry.urlDate);
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

// The site "flips" to the next day's entry at 2AM Pacific time (not at each
// visitor's local midnight, and not at UTC midnight) — so this reads the
// current date/hour in America/Los_Angeles specifically, DST included, and
// rolls back to the previous calendar day before 2AM.
function getCurrentEntryDateISO() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });

  const hour = Number(map.hour) % 24; // Intl can report "24" for midnight
  const current = new Date(Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day)));
  if (hour < 2) current.setUTCDate(current.getUTCDate() - 1);

  const y = current.getUTCFullYear();
  const m = String(current.getUTCMonth() + 1).padStart(2, "0");
  const d = String(current.getUTCDate()).padStart(2, "0");
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

// For the citation's URL Date: no weekday (unlike the entry's own date),
// and tolerant of manually-typed dates that aren't in YYYY-MM-DD or
// M/D/YYYY form — falls back to showing the raw text rather than an
// "Invalid Date".
function formatDateSafe(raw) {
  if (!raw) return "";
  const iso = normalizeDate(raw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return raw;

  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// "What Trump Did" is a citation, not a data column: it links back to the
// real source. When URL Date / URL New Org / URL Article Title are all
// filled in, it reads like a proper citation; otherwise it falls back to
// just the link's domain so an incomplete row never breaks.
function renderCitation(entry) {
  if (!entry.source) return "";

  const hasFullCitation = entry.urlOrg && entry.urlTitle;
  const label = hasFullCitation
    ? `${formatDateSafe(entry.urlDate)} &mdash; ${escapeHTML(entry.urlOrg)}: &ldquo;${escapeHTML(entry.urlTitle)}&rdquo;`
    : escapeHTML(extractDomain(entry.source));

  return `
    <div class="entry-citation">
      <h3>What Trump Did</h3>
      <p><a href="${escapeHTML(entry.source)}" target="_blank" rel="noopener">${label}</a></p>
    </div>
  `;
}

function renderEntryCard(entry) {
  const categoryTag = entry.category
    ? `<span class="entry-category">${escapeHTML(entry.category)}</span>`
    : "";

  return `
    <article class="entry-card">
      <div class="entry-meta">
        ${categoryTag}
        <p class="entry-date">${formatDateForDisplay(entry.date)}</p>
      </div>
      <h2 class="entry-headline">${escapeHTML(entry.headline)}</h2>
      <p class="entry-body">${escapeHTML(entry.bidenFrame)}</p>
      ${renderCitation(entry)}
    </article>
  `;
}
