# FamilyCareHub — Technical Specification

_Last updated: 2026-03-31_

---

## 1. Overview

FamilyCareHub is a family caregiver tool for tracking a family member's medications and medical appointments. It is a single-user web app protected by Google OAuth.

**Core capabilities:**
- Track medications with pill counts, refill dates, and pharmacy info
- Get status alerts (urgent / soon / stocked) based on days remaining
- Schedule and review medical appointments with prep notes and follow-up notes
- Assign who is covering each appointment (Fanuel / Saron / Both / TBD)

---

## 2. Stack & Architecture

| Layer       | Technology                              |
|-------------|-----------------------------------------|
| Frontend    | Vanilla JS, HTML, CSS — no framework    |
| Backend     | Firebase (Firestore + Google Auth)      |
| SDK         | Firebase JS SDK v10.14.1 via CDN        |
| Hosting     | Any static file server (no build step)  |

**Files:**
- `index.html` — HTML structure, modals, forms
- `styles.css` — Dark theme, responsive layout (≤700px breakpoint)
- `app.js` — All business logic, Firebase integration, state management

**Data flow:**
```
onAuthStateChanged
  └── startMedsListener()   → Firestore onSnapshot → meds[] → render()
  └── startAptsListener()   → Firestore onSnapshot → apts[] → renderApts()
  └── initCal()
```

All Firestore reads/writes happen directly from the browser. No server-side code.

---

## 3. Firebase Schema

### `medications` collection

| Field          | Type    | Required | Description                                      |
|----------------|---------|----------|--------------------------------------------------|
| `id`           | string  | yes      | `Date.now().toString(36)` + random suffix        |
| `name`         | string  | yes      | Medication name                                  |
| `dose`         | string  | no       | e.g. "500 mg"                                    |
| `frequency`    | number  | yes      | Pills per day (supports decimals e.g. 0.5)       |
| `filledDate`   | string  | yes      | ISO date when bottle was last picked up (YYYY-MM-DD) |
| `supply`       | number  | yes      | Pills in bottle at fill time                     |
| `refillDate`   | string  | no       | Manual override for refill date (YYYY-MM-DD)     |
| `pharmacy`     | string  | no       | Pharmacy name                                    |
| `rxNum`        | string  | no       | Prescription number                              |
| `doctor`       | string  | no       | Prescribing doctor                               |
| `instructions` | string  | no       | e.g. "Take with food"                            |
| `notes`        | string  | no       | Side effects, reminders, etc.                    |
| `updatedAt`    | string  | yes      | ISO timestamp of last write                      |

### `appointments` collection

| Field       | Type   | Required | Description                                           |
|-------------|--------|----------|-------------------------------------------------------|
| `id`        | string | yes      | `Date.now().toString(36)` + random suffix             |
| `title`     | string | yes      | Appointment name                                      |
| `dateTime`  | string | yes      | ISO datetime string (local time)                      |
| `type`      | string | no       | `checkup` / `specialist` / `lab` / `imaging` / `other` |
| `doctor`    | string | no       | Provider name                                         |
| `location`  | string | no       | Clinic or hospital                                    |
| `covering`  | string | no       | `fanuel` / `saron` / `both` / `tbd`                   |
| `prep`      | string | no       | Pre-visit instructions or questions                   |
| `postNotes` | string | no       | Follow-up notes written after the visit               |
| `updatedAt` | string | yes      | ISO timestamp of last write                           |

---

## 4. State Management

All state lives in module-scoped variables in `app.js`. No external state library.

```js
// Medications
let meds = []          // Live array from Firestore
let filter = 'all'     // 'all' | 'urgent' | 'soon' | 'ok'
let editId = null      // Medication ID being edited, or null for new
let unsubMeds = null   // Firestore unsubscribe fn

// Appointments
let apts = []          // Live array from Firestore
let editAptId = null   // Appointment ID being edited, or null for new
let unsubApts = null   // Firestore unsubscribe fn

// UI
let activeTab = 'meds' // 'meds' | 'apts'
let calYear, calMonth  // Mini calendar display month
```

On logout: unsubscribe fns are called, arrays cleared, login screen shown.

---

## 5. Key Algorithms

### `pillsNow(m)` — pill count calculation
```
elapsed_days  = today − filledDate
consumed      = min(elapsed_days × frequency, supply)
remaining     = supply − consumed
daysToZero    = ceil(remaining / frequency)
runOutDate    = today + daysToZero days
```
Returns `{ rem, tot, runOutDate, daysToZero }`.

### `st(m)` — refill status
| Condition          | Status    |
|--------------------|-----------|
| daysToZero ≤ 3     | `urgent`  |
| daysToZero 4–7     | `soon`    |
| daysToZero ≥ 8     | `ok`      |

### `getRefillDate(m)` — refill date
- If `m.refillDate` is set → use it (manual override)
- Otherwise → `filledDate + floor(supply / frequency)` days

### `aptStatus(a)` — appointment time bucket
| Condition              | Status      |
|------------------------|-------------|
| Before today           | `past`      |
| Within today           | `today`     |
| Within next 7 days     | `soon`      |
| Beyond 7 days          | `upcoming`  |

---

## 6. UI Features

### Medications view

- **KPI dashboard** — 4 cards: Total, Urgent (≤3 days), Soon (4–7 days), Stocked (8+ days). Urgent card lists medication names.
- **Filter tabs** — All / ≤3 days / 4–7 days / Stocked up. Persists in `filter` state.
- **Search** — Real-time filter by name, pharmacy, or doctor (case-insensitive).
- **Table** — Sorted by days until runout (urgent first). Columns: name+dose, status badge, pill count + progress bar, refill date, pharmacy, actions.
- **Actions** — Edit (pencil), Mark refilled (sets filledDate to today), Delete.
- **Export/Import** — CSV download, JSON backup download, JSON import (merges, does not replace).
- **Mobile (≤700px)** — Table converts to stacked card layout.

### Appointments view

- **Mini calendar** — Shows current month. Days with appointments have colored dots (Fanuel = violet, Saron = teal). Today = blue circle. Click a date to scroll to that appointment.
- **Hero card** — Highlights the next upcoming appointment. Color-coded: blue (today), amber (this week), green (upcoming). Expandable for prep and post-appointment notes.
- **Agenda** — Appointments grouped into: Today / This week / Upcoming / Past (collapsed by default). Each card is expandable.
- **Covering** — Fanuel (violet), Saron (teal), Both (split), TBD (gray). Shown as colored pill on cards and dots on calendar.
- **Appointment types** — Checkup, Specialist, Lab/blood work, Imaging, Other. Shown as small chip.

### Shared modal behavior
- Escape key or background click closes modal
- Required fields marked with red asterisk
- Confirmation dialog on delete

---

## 7. Design Decisions

| Decision | Rationale |
|---|---|
| Firebase API keys embedded in `app.js` | Intentional for client-side app — security enforced via Firestore rules in Firebase console, not in code |
| `esc()` applied to all user data in innerHTML | XSS prevention; replaces `&`, `<`, `>`, `"` before inserting into DOM |
| No npm / no bundler | Simplicity — open `index.html` directly, zero setup |
| Module-scoped state only | Avoids global namespace pollution without a framework |
| IDs as `Date.now().toString(36) + random` | Lightweight unique ID without a library |
| `filledDate` + `supply` + `frequency` model | Allows auto-calculating remaining pills without manual updates each day |
| `refillDate` as optional override | Accommodates pharmacies that set a specific pickup date different from the calculated runout |

---

## 8. Known Limitations / TODOs

_Update this section as limitations are discovered or resolved._

- [ ] No offline support — app requires network for Firestore reads/writes
- [ ] Single-user only — no multi-user data isolation (one Firestore project per user)
- [ ] No push notifications or reminders
- [ ] Appointment search does not filter by doctor, location, or type — only by title
