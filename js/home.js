async function renderHome() {
  const container = document.getElementById("entry-container");

  try {
    const entries = await fetchEntries();
    if (entries.length === 0) {
      container.innerHTML = `<p class="state-message">No entries yet. Add a row to your sheet to get started.</p>`;
      return;
    }

    const today = getTodayISO();
    const todayEntry = entries.find((e) => e.date === today);

    if (todayEntry) {
      container.innerHTML = renderEntryCard(todayEntry);
      return;
    }

    const mostRecent = entries[0]; // already sorted newest first
    container.innerHTML = `
      <p class="fallback-note">No entry for today yet — here's the most recent one.</p>
      ${renderEntryCard(mostRecent)}
    `;
  } catch (err) {
    container.innerHTML = `<p class="state-message">${escapeHTML(err.message)}</p>`;
  }
}

renderHome();
