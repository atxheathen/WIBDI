function initSignupForm() {
  const box = document.getElementById("signup-box");
  const form = document.getElementById("signup-form");
  if (!box || !form) return;

  if (!CONFIG.BUTTONDOWN_USERNAME) {
    box.style.display = "none";
    return;
  }

  form.action = `https://buttondown.com/api/emails/embed-subscribe/${CONFIG.BUTTONDOWN_USERNAME}`;
}

initSignupForm();
