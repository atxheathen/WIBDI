async function renderHome() {
  const container = document.getElementById("entry-container");

  try {
    const entries = await fetchEntries();
    if (entries.length === 0) {
      container.innerHTML = `<p class="state-message">No entries yet. Add a row to your sheet to get started.</p>`;
      return;
    }

    const today = getCurrentEntryDateISO();
    const todayEntry = entries.find((e) => e.date === today);

    // Shows today's entry when there is one; otherwise just the most recent
    // entry (already sorted newest first), with no "no entry for today" note.
    container.innerHTML = renderEntryCard(todayEntry || entries[0]);
  } catch (err) {
    container.innerHTML = `<p class="state-message">${escapeHTML(err.message)}</p>`;
  }
}

renderHome();
