# Booking Tracker

A personal travel Progressive Web App that consolidates fragmented bookings —
flights, hotels, Airbnbs, car rentals — into one calendar. Confirmation emails
are ingested automatically from Gmail; everything is also editable by hand from
a phone.

## Architecture

```
Gmail inbox ──> Google Apps Script (private, timed trigger)
                        │  parsed bookings, Firestore REST upserts
                        ▼
                  Firebase Firestore  <──  security rules: owner only
                        ▲
                        │  Firebase JS SDK + Google sign-in
              PWA on GitHub Pages (this repo)
```

- **Frontend** (this repo): Vite + vanilla TypeScript PWA, deployed to GitHub
  Pages by [.github/workflows/deploy.yml](.github/workflows/deploy.yml).
  Calendar month view, day-detail itinerary, phone-friendly add/edit forms,
  offline support.
- **Database & auth**: Firebase free tier. Bookings live under your user ID in
  Firestore; Google sign-in plus [firestore.rules](firestore.rules) make them
  readable and writable only by you. Firestore's local cache keeps the calendar
  working offline.
- **Email ingestion**: a Google Apps Script that lives only in your Google
  account. It is deliberately **not** committed to this public repo — nothing
  that touches Gmail (code, credentials, endpoint URLs) belongs here. Setup
  instructions: [docs/APPS_SCRIPT_SETUP.md](docs/APPS_SCRIPT_SETUP.md).

## Documentation

| Doc | Purpose |
| --- | --- |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | The Firestore schema — the contract between the PWA and the Apps Script |
| [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) | One-time Firebase project setup (console clicks) |
| [docs/APPS_SCRIPT_SETUP.md](docs/APPS_SCRIPT_SETUP.md) | Installing the private Gmail scanner |

## Local development

```
npm install
npm run dev
```

`npm run build` type-checks and produces the static site in `dist/`.

## Deployment

Every push to `main` builds and deploys to GitHub Pages via GitHub Actions.
One-time repo setting: **Settings → Pages → Source → GitHub Actions**.
