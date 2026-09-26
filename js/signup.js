// Captures email signups into a Google Form (which drops them into a
// Sheet you can open anytime) — this is list-building only, no emails
// are sent yet. Swapping in a real sender later (e.g. Buttondown) won't
// need to change this file.

function initSignupForm() {
  const box = document.getElementById("signup-box");
  const form = document.getElementById("signup-form");
  if (!box || !form) return;

  if (!CONFIG.EMAIL_SIGNUP_FORM_ACTION || !CONFIG.EMAIL_SIGNUP_ENTRY_ID) {
    box.style.display = "none";
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = form.querySelector('input[type="email"]');
    const button = form.querySelector("button");
    const email = input.value.trim();
    if (!email) return;

    const frequencyInput = form.querySelector('input[name="frequency"]:checked');
    const frequency = frequencyInput ? frequencyInput.value : "";

    button.disabled = true;
    button.textContent = "Submitting…";

    const body = new URLSearchParams();
    body.set(`entry.${CONFIG.EMAIL_SIGNUP_ENTRY_ID}`, email);
    if (frequency && CONFIG.EMAIL_SIGNUP_FREQUENCY_ENTRY_ID) {
      body.set(`entry.${CONFIG.EMAIL_SIGNUP_FREQUENCY_ENTRY_ID}`, frequency);
    }

    try {
      // Google Forms doesn't send CORS headers, so the response is opaque —
      // this only tells us the request went out, not whether Google accepted
      // it. That's an accepted trade-off of submitting a Form without
      // sending the visitor to a separate Google-hosted page.
      await fetch(CONFIG.EMAIL_SIGNUP_FORM_ACTION, {
        method: "POST",
        mode: "no-cors",
        body,
      });

      form.hidden = true;
      const thanks = document.createElement("p");
      thanks.className = "signup-thanks";
      thanks.textContent = "Thanks — you're on the list.";
      form.after(thanks);
    } catch {
      button.disabled = false;
      button.textContent = "Subscribe";
      const err = document.createElement("p");
      err.className = "signup-error";
      err.textContent = "Something went wrong — please try again.";
      form.after(err);
    }
  });
}

initSignupForm();
