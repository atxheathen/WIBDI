const THEMES = [
  { id: "corkboard", label: "Corkboard" },
  { id: "editorial", label: "Editorial" },
  { id: "dos", label: "DOS" },
  { id: "matrix", label: "Matrix" },
];

function initThemeSwitch() {
  const mount = document.getElementById("theme-switch");
  if (!mount) return;

  const current = document.documentElement.getAttribute("data-theme") || "editorial";

  const label = `<span class="theme-switch-label">Theme</span>`;
  const buttons = THEMES.map(
    (t) =>
      `<button type="button" class="theme-btn${t.id === current ? " is-active" : ""}" data-theme-id="${t.id}" aria-pressed="${t.id === current}">${t.label}</button>`
  ).join("");
  mount.innerHTML = `${label}<div class="theme-switch-buttons">${buttons}</div>`;

  mount.addEventListener("click", (event) => {
    const btn = event.target.closest(".theme-btn");
    if (!btn) return;

    const id = btn.dataset.themeId;
    document.documentElement.setAttribute("data-theme", id);
    try {
      localStorage.setItem("wibdiTheme", id);
    } catch {
      // Private browsing / storage disabled — theme just won't persist across visits.
    }

    mount.querySelectorAll(".theme-btn").forEach((b) => {
      const active = b.dataset.themeId === id;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  });
}

initThemeSwitch();
