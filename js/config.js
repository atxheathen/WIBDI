// Fill these in once you've set up your Google Sheet and (optionally) Buttondown.
// See SETUP.md for step-by-step instructions.

const CONFIG = {
  // File > Share > Publish to web > select the sheet tab > CSV > Publish, then paste the link here.
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTovrEdHL4X1r2Ssr33DFqaE1377ivWVnyBO20I71LzI5YN9lWCzfNsL53QHMMs2DZD6Y1VGjlMlZGM/pub?gid=1289964439&single=true&output=csv",

  // Cloudflare Worker that adds email signups to Resend (as Daily/Weekly
  // Topic subscriptions). The Worker holds the Resend API key server-side —
  // never put that key in this file, it's public.
  EMAIL_SIGNUP_WORKER_URL: "https://wibdi-signup.djohnson913.workers.dev",
};
