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

| Layer       | Technology                                        |
|-------------|---------------------------------------------------|
| Frontend    | React 18 (Vite build tool)                        |
| Backend     | Firebase (Firestore + Google Auth)                |
| SDK         | Firebase JS SDK v10.14.1 via npm                  |
| Hosting     | GitHub Pages (via GitHub Actions CI/CD)           |
| Testing     | Vitest + React Testing Library + jsdom            |

**Project layout:**
```
client/                        ← Vite project root
  src/
    main.jsx                   ← React entry point
    App.jsx                    ← Auth gate: LoginScreen or MainApp
    firebase.js                ← Firebase init; exports auth, provider, db
    hooks/
      useAuth.js               ← onAuthStateChanged wrapper
      useMeds.js               ← Firestore onSnapshot → meds[]
      useApts.js               ← Firestore onSnapshot → apts[]
    lib/
      medUtils.js              ← Pure fns: pillsNow, st, getRefillDate, fmtDate, …
      aptUtils.js              ← Pure fns: aptStatus, fmtAptDateBlock, fmtAptTime, …
      firestore.js             ← saveMed, delMed, markRefilled, saveApt, delApt, exportCSV, exportJSON, importMeds
    components/
      LoginScreen.jsx
      MainApp.jsx              ← Tab bar; owns medModalOpen / aptModalOpen state
      meds/
        MedicationsView.jsx    ← filter, search, editId state; renders KPIRow + MedsTable + MedModal
        KPIRow.jsx             ← 4 KPI cards (total, urgent, soon, stocked)
        MedsTable.jsx          ← Sorted table; status pills; progress bars
        MedModal.jsx           ← Add/edit form (9 fields)
      apts/
        AppointmentsView.jsx   ← Two-column layout; owns pastExpanded state
        MiniCalendar.jsx       ← Month grid with dot markers; click → expand past
        HeroCard.jsx           ← Next upcoming appointment highlight
        AgendaGroups.jsx       ← Today / This week / Upcoming / Past sections
        AptCard.jsx            ← Expandable appointment card
        AptModal.jsx           ← Add/edit form
  vite.config.js               ← base: '/dad-med-tracker/', test config
  package.json
  dist/                        ← Build output (git-ignored); deployed by CI
```

**Data flow:**
```
useAuth()
  → null (logged out) → LoginScreen
  → user object       → MainApp
      ├── useMeds()   → Firestore onSnapshot → meds[] (live)
      └── useApts()   → Firestore onSnapshot → apts[] (live)
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

State is managed via React hooks — no external state library.

```
App.jsx
  useAuth()                    → undefined (loading) | null (logged out) | user

MainApp.jsx
  medModalOpen: boolean        → controls "Add medication" modal from topbar
  aptModalOpen: boolean        → controls "Add appointment" modal from topbar
  addTrigger / onAddHandled    → increment-and-reset pattern for child modal open

MedicationsView.jsx
  filter: 'all'|'urgent'|'soon'|'ok'
  search: string
  editId: undefined|null|string  → undefined = closed, null = new, string = editing

AppointmentsView.jsx
  pastExpanded: boolean        → shared between MiniCalendar (write) and AgendaGroups (read)

MiniCalendar.jsx
  calYear, calMonth            → local display month (independent of today)
```

On logout: `useAuth` returns `null`, App unmounts MainApp entirely, Firestore listeners are cleaned up via hook effect cleanup.

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

- **Mini calendar** — Shows current month. Days with appointments have colored dots (Fanuel = violet, Saron = teal). Today = blue circle. Click a past date to expand the Past section.
- **Hero card** — Highlights the next upcoming appointment. Color-coded: blue (today), amber (this week), green (upcoming). Expandable for prep and post-appointment notes.
- **Agenda** — Appointments grouped into: Today / This week / Upcoming / Past (collapsed by default). Each card is expandable.
- **Covering** — Fanuel (violet), Saron (teal), Both (split), TBD (gray). Shown as colored pill on cards and dots on calendar.
- **Appointment types** — Checkup, Specialist, Lab/blood work, Imaging, Other. Shown as small chip.

### Shared modal behavior
- Escape key or background click closes modal
- Required fields marked with red asterisk
- Confirmation dialog on delete

---

## 7. Build & Deployment

**Local development:**
```bash
cd client
npm_config_cache=/tmp/npm-cache npm install
npm run dev        # Vite dev server at http://localhost:5173
npm test           # Vitest (44 tests)
npm run build      # Output to client/dist/
```

**CI/CD — GitHub Actions (`.github/workflows/deploy.yml`):**
- Triggers on push to `main`
- Installs deps, runs `npm run build`, uploads `client/dist/` as Pages artifact
- Deploys to GitHub Pages at `https://staticHawkins.github.io/dad-med-tracker/`
- Requires GitHub repo settings: Pages source = GitHub Actions

**Base path:** Vite is configured with `base: '/dad-med-tracker/'` so all asset URLs resolve correctly under the GitHub Pages subdirectory URL.

---

## 8. Testing

**Framework:** Vitest + React Testing Library + jsdom

**Setup:** `client/src/test/setup.js` imports `@testing-library/jest-dom` for DOM matchers.

**Test files:**

| File | Tests | What it covers |
|------|-------|----------------|
| `medUtils.test.js` | 15 | `pillsNow`, `st`, `stLabel`, `getRefillDate`, `fmtDate` |
| `aptUtils.test.js` | 13 | `aptStatus`, `fmtAptDateBlock`, `fmtAptTime`, `coveringLabel`, `typeLabel` |
| `KPIRow.test.jsx` | 5 | KPI card rendering, urgent counts, empty state |
| `MedsTable.test.jsx` | 7 | Table render, filtering, sorting, status pills |

All date-dependent tests use `vi.useFakeTimers()` / `vi.setSystemTime()` pinned to `2026-03-31`.

**Run tests:**
```bash
cd client && npm_config_cache=/tmp/npm-cache npm test
```

---

## 9. Design Decisions

| Decision | Rationale |
|---|---|
| React + Vite (not vanilla JS) | Enables component-based UI, proper test infrastructure, and CI/CD build pipeline |
| Vite over webpack/CRA | Fast HMR, minimal config, native ESM, built-in Vitest support |
| `base: '/dad-med-tracker/'` in vite.config | Required for correct asset resolution on GitHub Pages subdirectory URL |
| Firebase API keys embedded in `firebase.js` | Intentional for client-side app — security enforced via Firestore rules in Firebase console |
| `addTrigger` + `onAddHandled` prop pattern | Allows topbar "Add" button in MainApp to open modals owned by child views without lifting all modal state |
| `pastExpanded` lifted to AppointmentsView | Both MiniCalendar (writes it) and AgendaGroups (reads it) need it — lifted to their common parent |
| `editId: undefined` = modal closed | Three-value state (undefined/null/string) cleanly distinguishes closed / new / editing without a separate boolean |
| `filledDate` + `supply` + `frequency` model | Allows auto-calculating remaining pills without manual updates each day |
| `refillDate` as optional override | Accommodates pharmacies that set a specific pickup date different from the calculated runout |
| IDs as `Date.now().toString(36)` + random | Lightweight unique ID without a library |

---

## 10. Known Limitations / TODOs

_Update this section as limitations are discovered or resolved._

- [ ] No offline support — app requires network for Firestore reads/writes
- [ ] Single-user only — no multi-user data isolation (one Firestore project per user)
- [ ] No push notifications or reminders
- [ ] Appointment search does not filter by doctor, location, or type — only by title
- [ ] CLAUDE.md still describes the old vanilla JS app — needs updating after React migration merges
