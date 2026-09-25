async function renderHistory() {
  const container = document.getElementById("history-container");

  try {
    const entries = await fetchEntries();
    if (entries.length === 0) {
      container.innerHTML = `<p class="state-message">No entries yet.</p>`;
      return;
    }

    container.innerHTML = entries.map(renderEntryCard).join("");
  } catch (err) {
    container.innerHTML = `<p class="state-message">${escapeHTML(err.message)}</p>`;
  }
}

renderHistory();
