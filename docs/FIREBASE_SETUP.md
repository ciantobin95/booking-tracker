# Firebase Setup (one-time, ~5 minutes)

The app stores bookings in Firebase Firestore and uses Google sign-in. This is
a one-time setup done in the Firebase console; everything below stays on the
free (Spark) plan.

## 1. Create the project

1. Go to <https://console.firebase.google.com> and sign in with the same
   Google account that owns your Gmail (this matters later — the email scanner
   authenticates as the project owner).
2. **Add project** → name it e.g. `booking-tracker` → Google Analytics is not
   needed (disable it) → **Create project**.

## 2. Enable Google sign-in

1. In the left menu: **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Google** → Enable → pick your support email →
   **Save**.
3. Still in Authentication: **Settings → Authorized domains → Add domain** and
   add your GitHub Pages domain, e.g. `<your-github-username>.github.io`.
   (`localhost` is already authorized for development.)

## 3. Create the Firestore database

1. **Build → Firestore Database → Create database**.
2. Location: pick a European region (e.g. `europe-west1`); this cannot be
   changed later.
3. Start in **production mode** (locked). We replace the rules next.

## 4. Apply the security rules

1. Firestore Database → **Rules** tab.
2. Replace the contents with the rules from [`firestore.rules`](../firestore.rules)
   in this repo, then **Publish**.

These rules mean: only a signed-in user can touch documents under their own
user ID. Nobody else — even with the public config values below — can read
your data.

## 5. Register the web app and fill in the config

1. Project overview → gear icon → **Project settings** → **Your apps** →
   web icon (`</>`).
2. Nickname e.g. `booking-tracker-web`. Do NOT tick Firebase Hosting (we host
   on GitHub Pages). **Register app**.
3. Firebase shows a `firebaseConfig` object. Copy its values into
   [`src/firebase-config.ts`](../src/firebase-config.ts) in this repo and
   commit. These values are public identifiers, not secrets — committing them
   is safe and standard.

## 6. Deploy and sign in

Push to `main` (or merge the PR); GitHub Actions deploys the app. Open it,
sign in with your Google account, and you're done.

## 7. Find your user ID (needed by the email scanner)

After signing in, open the app's **Settings** panel — it shows your Firebase
user ID (UID) with a copy button. You'll paste that into the Apps Script's
Script Properties when setting up the Gmail scanner
([APPS_SCRIPT_SETUP.md](APPS_SCRIPT_SETUP.md)).

## Costs and limits

The free tier includes 50k document reads and 20k writes per day and 1 GiB of
storage. A single user's travel calendar uses a small fraction of a percent of
that. No credit card is required.
