# Gmail Scanner Setup (Google Apps Script)

The email scanner is a Google Apps Script that lives **only in your Google
account**. Its source code is deliberately not in this public repo — nothing
that touches Gmail (code, credentials, endpoint URLs) belongs here. You
received the script file (`Code.gs`) privately; keep your own copy somewhere
private (e.g. a private gist or the Apps Script project itself).

What it does, every 15 minutes:

1. Searches recent mail for booking-like emails (known senders — Ryanair,
   Aer Lingus, Booking.com, Airbnb — plus generic confirmation language for
   any other airline or hotel site).
2. Parses them into the data model (see [DATA_MODEL.md](DATA_MODEL.md)) and
   upserts into Firestore with deterministic IDs, so nothing is ever
   duplicated. A re-sent confirmation with the same reference **updates** the
   existing booking (this is how airline modification emails work); legs
   missing from a newer itinerary are marked superseded; cancellation emails
   mark bookings cancelled. Your manual edits in the app are never
   overwritten by a re-delivered email.
3. Labels processed threads `BookingTracker/Processed`, and anything it
   couldn't fully parse `BookingTracker/NeedsReview` (those also appear in
   the app's Review list).
4. Emails you if a run hits errors (throttled to at most one alert per 6h).

## Prerequisites

- Firebase project set up ([FIREBASE_SETUP.md](FIREBASE_SETUP.md)) **with the
  same Google account that owns the Gmail inbox** — the script writes to
  Firestore using your own Google login, so no service-account keys or API
  secrets exist anywhere.
- Your user ID (UID) from the app's Settings panel.

## Install (~10 minutes)

1. Go to <https://script.google.com> (signed in as the same account) →
   **New project**. Name it e.g. `booking-tracker-scanner`.
2. Replace the editor's contents with the `Code.gs` you received.
3. Enable the manifest: gear icon (Project Settings) → tick **Show
   "appsscript.json" manifest file**. Open `appsscript.json` in the editor
   and replace it with:

   ```json
   {
     "timeZone": "Europe/Dublin",
     "exceptionLogging": "STACKDRIVER",
     "runtimeVersion": "V8",
     "oauthScopes": [
       "https://www.googleapis.com/auth/gmail.modify",
       "https://www.googleapis.com/auth/script.external_request",
       "https://www.googleapis.com/auth/datastore",
       "https://www.googleapis.com/auth/script.scriptapp",
       "https://www.googleapis.com/auth/script.send_mail",
       "https://www.googleapis.com/auth/userinfo.email"
     ]
   }
   ```

   These are the minimum scopes: read/label Gmail, call Firestore, manage its
   own trigger, and email you on errors.

4. Project Settings → **Script Properties** → add:

   | Property | Value |
   | --- | --- |
   | `FIREBASE_PROJECT_ID` | your Firebase project ID (Firebase console → Project settings) |
   | `FIREBASE_UID` | your user ID, copied from the app's Settings panel |
   | `GEMINI_API_KEY` | *(optional — see below)* |

5. In the editor, select the `setup` function and **Run** it once. Grant the
   permission prompts (this authorizes *your own account only*; nothing is
   shared with anyone). This creates the Gmail labels and the 15-minute
   trigger.

6. Done. New confirmation emails now appear in the app within ~15 minutes.
   The first run only looks back 14 days (`SEARCH_WINDOW` in the script) —
   it will not trawl your email history.

## Optional: AI fallback for unknown senders (`GEMINI_API_KEY`)

Without a key, emails from unknown airlines/hotel sites are parsed with
conservative built-in heuristics and flagged for review — fully private.

If you set `GEMINI_API_KEY` (free key from <https://aistudio.google.com>),
unknown-sender emails are instead sent to Google's Gemini API for extraction,
which reads new formats much better. **Privacy trade-off:** Google may use
free-tier Gemini API data for product improvement. Only emails already
detected as booking confirmations are ever sent — never your inbox at large.
AI-extracted bookings are always marked "needs review" in the app until you
confirm them. Known senders (Ryanair, Aer Lingus, Booking.com, Airbnb) are
always parsed locally and never sent to the AI, with or without a key.

The key lives only in Script Properties — never in code, never in this repo.

## Security notes

- The script's Gmail access is scoped to your account and is granted by you
  to your own script; there is no server, no third party, and nothing public.
- Do not commit `Code.gs`, your UID, or any key to a public repository.
- To stop the scanner: Apps Script editor → Triggers → delete the
  `scanInbox` trigger. To remove all access: <https://myaccount.google.com/permissions>.
