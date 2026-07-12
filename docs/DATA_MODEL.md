# Data Model

This document is the shared contract between the PWA (this repo) and the private
Gmail-scanner Apps Script. Both read and write the same Firestore documents; any
change here must be reflected in both.

## Location

Every booking is a document at:

```
users/{uid}/bookings/{bookingId}
```

`uid` is the Firebase Auth user ID of the owner. Security rules restrict all
reads and writes under `users/{uid}` to that signed-in user. The Apps Script
writes through the Firestore REST API using the project owner's own OAuth
grant (IAM-level access), so no service-account keys exist anywhere.

## Document IDs (deduplication)

IDs are deterministic so that re-processing the same email is an idempotent
upsert, never a duplicate:

- Flight leg: `f_{sender}_{confirmationCode}_{flightNumber}_{startDate}`
- Stay with a confirmation code: `s_{sender}_{confirmationCode}`
- Stay without a code (e.g. Airbnb threads): `s_{sender}_{propertySlug}_{startDate}`
- Manual entries: `m_` + a random Firestore ID.

All ID components are lowercased with non-alphanumerics collapsed to `-`.

One reservation email can produce multiple documents (e.g. a Ryanair round
trip creates one document per flight leg, both sharing `confirmationCode`).

## Common fields (all bookings)

| Field | Type | Notes |
| --- | --- | --- |
| `type` | string | `flight` \| `stay` \| `car` |
| `status` | string | `confirmed` \| `cancelled` \| `needs_review` |
| `partial` | boolean | true when known fields are missing (e.g. Airbnb threads without cost); cleared by editing in the app |
| `title` | string | human summary, e.g. `EI 0108 JFK → DUB` or `Arco Barcelona Hotel` |
| `confirmationCode` | string \| null | booking reference / reservation number |
| `startDate` | string | `YYYY-MM-DD`. Flight: departure date (local). Stay: check-in date. |
| `endDate` | string | `YYYY-MM-DD`, >= startDate. Flight: arrival date (next day when the flight lands after midnight). Stay: check-out date. |
| `costAmount` | number \| null | numeric amount, e.g. `123.99` |
| `costCurrency` | string | ISO code, normally `EUR` |
| `costScope` | string | `booking` (this document only) or `reservation` (total for all legs sharing the confirmation code — never faked per-leg) |
| `source` | string | `manual` \| `gmail` |
| `sender` | string \| null | parser that produced it: `ryanair`, `aerlingus`, `booking.com`, `airbnb`, `generic`, or null for manual entries |
| `gmailMessageId` | string \| null | for the "open source email" link (`https://mail.google.com/mail/u/0/#all/{id}`) |
| `gmailThreadId` | string \| null | |
| `notes` | string | free text, editable in the app |
| `history` | array | `{ at: ISO timestamp, note: string }` appended on every automated create/update/cancel |
| `parseFingerprint` | string | scanner-internal: hash of the last-ingested email content, used to tell "same email re-delivered" (skip, preserving user edits) from "genuine modification" (merge + history note). Absent on manual entries. |
| `createdAt` / `updatedAt` | timestamp | ISO timestamps (set by the scanner) or server timestamps (set by the app) |

Dates and times are stored as plain local strings on purpose: flight times are
always displayed in each airport's local time exactly as the airline stated
them, with no timezone conversion anywhere.

## `flight` details (when `type == "flight"`)

| Field | Type | Notes |
| --- | --- | --- |
| `airline` | string | e.g. `Aer Lingus` |
| `flightNumber` | string | normalized, e.g. `EI 0108`, `FR 6131` |
| `depAirportCode` / `arrAirportCode` | string | IATA, e.g. `JFK` |
| `depAirportName` / `arrAirportName` | string | e.g. `John F Kennedy International` |
| `depTerminal` / `arrTerminal` | string | e.g. `Terminal 7` |
| `depTime` / `arrTime` | string | `HH:MM` local to the airport |
| `arrivesNextDay` | boolean | lands the day after departure |
| `fareType` | string | e.g. `O/Economy Class` |
| `durationText` | string | e.g. `06h 45m` |
| `seat` | string | e.g. `28F` |
| `bags` | string[] | e.g. `["10kg/22lbs bag", "Carry-on bag included"]` |
| `passengers` | string[] | passenger names |

## `stay` details (when `type == "stay"`)

| Field | Type | Notes |
| --- | --- | --- |
| `propertyName` | string | |
| `address` | string | |
| `phone` | string | property phone |
| `platform` | string | `Booking.com`, `Airbnb`, `Direct`, … |
| `pin` | string | Booking.com modification PIN. Sensitive: only rendered inside the day-detail view, never logged. |
| `checkInTime` / `checkOutTime` | string | `HH:MM` when known |
| `guestsText` | string | e.g. `1 adult`, `7 adults` |
| `mealPlan` | string | e.g. `Breakfast costs €15 per person per night` |
| `cancellationPolicy` | string | short policy summary |

## `car` details (when `type == "car"`)

| Field | Type | Notes |
| --- | --- | --- |
| `company` | string | |
| `pickupLocation` / `dropoffLocation` | string | |
| `pickupTime` / `dropoffTime` | string | `HH:MM` |

## Upsert semantics (modifications)

Modification emails can be indistinguishable from first confirmations (Aer
Lingus re-sends a normal "Booking Confirmation" with the same reference and
new flight details). Ingestion therefore treats every parsed email as the
latest truth for its reservation:

1. Compute deterministic document IDs for everything found in the email.
2. Create documents that do not exist yet.
3. Overwrite parsed fields of documents that already exist (a change-history
   note is appended when meaningful fields changed).
4. For multi-leg reservations, any existing leg with the same
   `confirmationCode` that is absent from the newer email is marked
   `status: cancelled` with a "superseded by newer confirmation" history note.

Cancellation emails set `status: cancelled` on the matching documents;
documents are never deleted by automation, so history is preserved.

## Calendar rendering rules

- A booking highlights every day from `startDate` to `endDate` inclusive.
- Stays render as a range (check-in day, nights, check-out day).
- Flights render on the departure day (and on the arrival day when
  `arrivesNextDay` is true).
- `cancelled` bookings stay visible in the day detail (struck through) but do
  not highlight days on their own.
- `needs_review` / `partial` bookings are surfaced in the review list until
  confirmed or completed in the app.
