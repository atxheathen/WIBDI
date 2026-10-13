async function renderHistory() {
  const container = document.getElementById("history-container");

  try {
    // Entries come back newest first and never include future dates, so
    // entries[0] is always the one the Home page is showing. History lists
    // only the earlier ones; an entry moves here once the next one takes over.
    const entries = (await fetchEntries()).slice(1);
    if (entries.length === 0) {
      container.innerHTML = `<p class="state-message">No earlier entries yet.</p>`;
      return;
    }

    container.innerHTML = entries.map(renderEntryCard).join("");
  } catch (err) {
    container.innerHTML = `<p class="state-message">${escapeHTML(err.message)}</p>`;
  }
}

renderHistory();
