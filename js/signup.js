// Captures email signups via a Cloudflare Worker, which adds the contact to
// Resend as a Daily or Weekly Topic subscriber (and handles unsubscribe —
// see the Worker's own code for the Resend API call).
//
// Drives every .signup-form on the page independently (the compact bar at
// the top and the full box at the bottom both use this).

function initSignupForm(form) {
  const box = form.closest(".signup-box, .signup-bar");
  if (!box) return;

  if (!CONFIG.EMAIL_SIGNUP_WORKER_URL) {
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

    const existingError = box.querySelector(".signup-error");
    if (existingError) existingError.remove();

    button.disabled = true;
    button.textContent = "Submitting…";

    try {
      const res = await fetch(CONFIG.EMAIL_SIGNUP_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, frequency }),
      });

      if (!res.ok) throw new Error("Signup failed");

      form.style.display = "none";
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

document.querySelectorAll(".signup-form").forEach(initSignupForm);
